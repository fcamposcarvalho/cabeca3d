# Cabeça 3D: instalação e atualização (pessoal)

> Arquivo pessoal, com endereços e caminhos do meu servidor. **Não publicar** (não vai para o GitHub nem para a página publicada).

Versão do modelo: **v2.1** (10 nov 2026)

O modelo é um site estático: `index.html`, `app.js`, `estilo.css`, a pasta `manual/` (página e PDF do manual) e a cópia do three.js na pasta `vendor/`. Qualquer servidor de arquivos serve; aqui, o próprio Python no Ubuntu.

## 1. Onde ficam os arquivos no servidor

```
~/estudo/cursopython/CorpoHumano/cabeca3d/
├── abrir_modelo3d.py      ← servidor web do modelo
├── LEIAME.md              ← resumo e fontes
├── modelo3d/
│   ├── index.html
│   ├── app.js
│   ├── estilo.css
│   ├── manual/            ← manual.html, manual.pdf, img/, katex/
│   └── vendor/three/      ← three.js 0.160 (não muda)
└── python/                ← pôsteres, simulação e animação
```

## 2. Ligar o servidor

No Ubuntu (192.168.15.200), com o ambiente conda ativo:

```bash
conda activate cursopython
cd ~/estudo/cursopython/CorpoHumano/cabeca3d
python abrir_modelo3d.py
```

O script só serve a pasta `modelo3d` pela web; não processa nada. Por padrão usa a porta **8002** (a 8000 é do portal finanças) e aceita acessos da rede. No notebook: **http://192.168.15.200:8002**

| Opção | O que faz |
| --- | --- |
| (nenhuma) | Rede liberada, porta 8002 ou a próxima livre, QR code no terminal |
| `--local` | Aceita só o próprio computador (127.0.0.1) |
| `--porta 8010` | Começa a procurar porta livre a partir da 8010 |
| `--sem-navegador` | Não tenta abrir o navegador (via SSH ele já não tenta) |
| `--sem-qr` | Não mostra o QR code |
| `--log` | Mostra cada acesso no terminal |
| `--instalar-servico` | Cria um serviço systemd que sobe sozinho no boot |
| `--remover-servico` | Remove esse serviço |

## 3. Deixar ligado sempre

```bash
python abrir_modelo3d.py --instalar-servico
systemctl --user status modelo3d     # conferir
journalctl --user -u modelo3d -f     # ver o log
systemctl --user restart modelo3d    # reiniciar depois de mudar o script
```

O serviço é de usuário e usa `loginctl enable-linger`, então continua rodando sem ninguém logado. O firewall (ufw) estava inativo; se for ativado: `sudo ufw allow 8002/tcp` (a regra sobrevive ao reboot).

## 4. Atualizar a partir do Windows

Cada atualização chega como **modelo3d_atualizado.zip**, com `index.html`, `app.js`, `estilo.css` e a pasta `manual/`. Troque sempre tudo junto: um `app.js` novo com um `index.html` antigo já fez a cabeça sumir.

Extrair no Windows Explorer ou no 7-Zip demora 30 a 40 s por causa do Microsoft Defender. Caminhos rápidos:

1. **PowerShell**, na pasta do zip: `tar -xf modelo3d_atualizado.zip` (ou `Expand-Archive -Force modelo3d_atualizado.zip .`).
2. **Direto no servidor** (troque `usuario` pelo seu usuário do Ubuntu):

```powershell
scp modelo3d_atualizado.zip usuario@192.168.15.200:~/estudo/cursopython/CorpoHumano/cabeca3d/modelo3d/
ssh usuario@192.168.15.200 "cd ~/estudo/cursopython/CorpoHumano/cabeca3d/modelo3d && unzip -o modelo3d_atualizado.zip"
```

A função `atualizar-modelo` do perfil do PowerShell faz esses dois passos. O `unzip -o` cria e atualiza a subpasta `manual/` sozinho. Depois, no navegador, **Ctrl+F5**; o rodapé do menu confirma a versão.

## 5. Publicar no GitHub Pages (sem git)

O GitHub só deixa escolher a branch **depois** que o repositório tem algum arquivo. Com o repositório vazio, a página Pages mostra "GitHub Pages is currently disabled" e só a opção **None**.

1. Criar o repositório público (por exemplo `cabeca3d`), sem README.
2. Na página inicial do repositório: **Add file → Upload files** (ou o link "uploading an existing file").
3. Arrastar de uma vez: `index.html`, `app.js`, `estilo.css` e as pastas **`vendor`** e **`manual`** inteiras. Arrastar pastas mantém as subpastas (o botão "choose your files" não envia pastas).
4. Embaixo, **Commit changes** (direto na branch `main`).
5. **Settings → Pages**: em Branch, trocar **None** por **main**; aparece ao lado a pasta, deixar **/ (root)**; **Save**.
6. Em um ou dois minutos: **https://fcamposcarvalho.github.io/cabeca3d/**

Não subir este arquivo, o `LEIAME.md`, o `abrir_modelo3d.py` nem a pasta `python/` (não fazem parte do site).

Nas atualizações: **Add file → Upload files** com os três arquivos e a pasta `manual`; o GitHub substitui os de mesmo nome. A pasta `vendor` não muda. Em https, o botão Copiar imagem funciona.

## 6. Navegador e WebGL

Se o Edge mostrar "WebGL indisponível": ligar **Usar aceleração de gráficos quando disponível** em `edge://settings/system`, reiniciar o navegador e conferir em `edge://gpu` que WebGL aparece como acelerado por hardware. No Chrome costuma funcionar direto.

## 7. Problemas já resolvidos

| Sintoma | Solução |
| --- | --- |
| "Address already in use" | O script pula para a próxima porta livre; a 8000 é do portal finanças |
| Notebook não abre o endereço | Rodar sem `--local`; se o ufw estiver ativo, liberar a 8002 |
| Erro de X11 via SSH | Já corrigido: via SSH o script não abre navegador |
| Cabeça sumiu depois de atualizar | Trocar todos os arquivos do zip e Ctrl+F5 |
| Extração lenta no Windows | `tar -xf` no PowerShell ou `unzip` no servidor |
| Navegador bloqueia download de `.js` | Por isso as atualizações vêm em zip |
