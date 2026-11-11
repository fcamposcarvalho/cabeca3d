"""Serve o modelo 3D por HTTP para abrir no navegador.

Navegadores bloqueiam módulos JavaScript abertos direto do disco (file://),
então este script sobe um pequeno servidor.

Por padrão, aceita conexões da rede local (para abrir do notebook) e mostra
um QR code para abrir no celular (se o pacote "qrcode" estiver instalado).

Exemplos:
    python abrir_modelo3d.py                    rede local, porta 8002 (ou a próxima livre)
    python abrir_modelo3d.py --porta 8080       outra porta
    python abrir_modelo3d.py --local            só neste computador (127.0.0.1)
    python abrir_modelo3d.py --log              mostra cada acesso no terminal
    python abrir_modelo3d.py --instalar-servico sobe sozinho sempre que o servidor ligar (systemd)
    python abrir_modelo3d.py --remover-servico  desfaz o serviço
Ctrl+C para encerrar.

Quando roda por SSH (ou sem tela), não tenta abrir navegador no servidor.
"""
import argparse
import functools
import getpass
import http.server
import os
import shutil
import socket
import socketserver
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

SCRIPT = Path(__file__).resolve()
PASTA = SCRIPT.parent / "modelo3d"
PORTA_PADRAO = 8002
SERVICO = "modelo3d"
UNIDADE = Path.home() / ".config" / "systemd" / "user" / f"{SERVICO}.service"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}
    mostrar_log = False

    def log_message(self, fmt, *args):
        if self.mostrar_log:
            super().log_message(fmt, *args)


class Servidor(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def ips_da_rede():
    """IPs desta máquina na rede local (o UDP só escolhe a interface; nada é enviado)."""
    ips = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            ips.append(s.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ips or ["IP-DO-SERVIDOR"]


def mostrar_qr(url):
    try:
        import qrcode
    except ImportError:
        print("  (Para ver um QR code aqui e abrir no celular:  pip install qrcode)")
        return
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make(fit=True)
    print("\n  Aponte a câmera do celular (mesma rede Wi-Fi):")
    qr.print_ascii(invert=True)


def abrir_servidor(host, inicio, tentativas=20):
    for porta in range(inicio, inicio + tentativas):
        try:
            return Servidor((host, porta), functools.partial(Handler, directory=str(PASTA))), porta
        except OSError:
            print(f"Porta {porta} ocupada, tentando a próxima...")
    sys.exit(f"Nenhuma porta livre entre {inicio} e {inicio + tentativas - 1}.")


# ------------------------------------------------------------------ serviço systemd (usuário)
def rodar(cmd, obrigatorio=True):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError:
        if obrigatorio:
            sys.exit(f"Comando não encontrado: {cmd[0]}. Este recurso precisa de Linux com systemd.")
        return False
    if r.returncode != 0 and obrigatorio:
        dica = ""
        if "bus" in r.stderr.lower():
            dica = ("\nDica: a sessão de usuário do systemd não foi encontrada. Tente:\n"
                    "   export XDG_RUNTIME_DIR=/run/user/$(id -u)\n"
                    "e rode de novo (ou faça login por SSH normalmente, sem 'su').")
        sys.exit(f"Falhou: {' '.join(cmd)}\n{r.stderr.strip()}{dica}")
    return r.returncode == 0


def instalar_servico(args):
    if not shutil.which("systemctl"):
        sys.exit("systemctl não encontrado: o serviço automático só funciona em Linux com systemd.")
    extra = " --local" if args.local else ""
    UNIDADE.parent.mkdir(parents=True, exist_ok=True)
    UNIDADE.write_text(f"""[Unit]
Description=Modelo 3D da cabeça (pineal e hipófise)
After=network-online.target

[Service]
ExecStart={sys.executable} -u {SCRIPT} --sem-navegador --sem-qr --porta {args.porta}{extra}
WorkingDirectory={SCRIPT.parent}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
""", encoding="utf-8")
    print(f"Unidade criada: {UNIDADE}")
    rodar(["systemctl", "--user", "daemon-reload"])
    rodar(["systemctl", "--user", "enable", "--now", f"{SERVICO}.service"])
    usuario = getpass.getuser()
    if rodar(["loginctl", "enable-linger", usuario], obrigatorio=False):
        print("Ativado o modo 'linger': o serviço sobe no boot mesmo sem você fazer login.")
    else:
        print("Para o serviço subir no boot mesmo sem login, rode uma vez:")
        print(f"   sudo loginctl enable-linger {usuario}")
    porta = args.porta
    ip = ips_da_rede()[0]
    print(f"\nPronto! O modelo está no ar em  http://{ip if not args.local else '127.0.0.1'}:{porta}/index.html")
    print("Se essa porta estiver ocupada no boot, o serviço usa a próxima livre (veja no log).")
    print("Comandos úteis:")
    print(f"   systemctl --user status {SERVICO}       # ver se está rodando")
    print(f"   journalctl --user -u {SERVICO} -f        # ver o log (endereço e porta)")
    print(f"   systemctl --user restart {SERVICO}      # reiniciar depois de editar os arquivos")
    print("   python abrir_modelo3d.py --remover-servico")


def remover_servico():
    if not shutil.which("systemctl"):
        sys.exit("systemctl não encontrado.")
    rodar(["systemctl", "--user", "disable", "--now", f"{SERVICO}.service"], obrigatorio=False)
    if UNIDADE.exists():
        UNIDADE.unlink()
        print(f"Removido: {UNIDADE}")
    rodar(["systemctl", "--user", "daemon-reload"], obrigatorio=False)
    print("Serviço removido. (O modo linger continua ativo; para desligar: sudo loginctl disable-linger $USER)")


# ------------------------------------------------------------------ principal
def main():
    ap = argparse.ArgumentParser(description="Serve o modelo 3D da cabeça.")
    ap.add_argument("--local", action="store_true", help="aceitar só conexões deste computador")
    ap.add_argument("--porta", type=int, default=PORTA_PADRAO, help=f"porta inicial (padrão {PORTA_PADRAO})")
    ap.add_argument("--sem-navegador", action="store_true", help="não tentar abrir o navegador")
    ap.add_argument("--sem-qr", action="store_true", help="não mostrar o QR code")
    ap.add_argument("--log", action="store_true", help="mostrar cada acesso no terminal")
    ap.add_argument("--instalar-servico", action="store_true", help="instalar serviço systemd que sobe no boot")
    ap.add_argument("--remover-servico", action="store_true", help="remover o serviço systemd")
    args = ap.parse_args()

    if args.instalar_servico:
        return instalar_servico(args)
    if args.remover_servico:
        return remover_servico()

    if not (PASTA / "index.html").exists():
        sys.exit(f"Não encontrei {PASTA / 'index.html'}. O script precisa ficar na mesma pasta que a subpasta modelo3d.")

    Handler.mostrar_log = args.log
    host = "127.0.0.1" if args.local else "0.0.0.0"
    srv, porta = abrir_servidor(host, args.porta)
    via_ssh = bool(os.environ.get("SSH_CONNECTION"))

    print(f"\nModelo 3D no ar (porta {porta}).")
    if args.local:
        print(f"  Neste computador:  http://127.0.0.1:{porta}/index.html")
        if via_ssh:
            print(f"  Pelo notebook, crie um túnel:  ssh -L {porta}:127.0.0.1:{porta} {getpass.getuser()}@IP-DO-SERVIDOR")
            print(f"  e abra  http://localhost:{porta}/index.html")
    else:
        ips = ips_da_rede()
        for ip in ips:
            print(f"  Pelo notebook:     http://{ip}:{porta}/index.html")
        print(f"  Neste computador:  http://127.0.0.1:{porta}/index.html")
        if not args.sem_qr:
            mostrar_qr(f"http://{ips[0]}:{porta}/index.html")
    print("Ctrl+C para encerrar.\n", flush=True)

    sem_tela = via_ssh or not (os.environ.get("DISPLAY") or sys.platform in ("win32", "darwin"))
    if not (args.sem_navegador or sem_tela):
        threading.Timer(0.8, lambda: webbrowser.open(f"http://127.0.0.1:{porta}/index.html")).start()

    with srv:
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nEncerrado.")


if __name__ == "__main__":
    main()
