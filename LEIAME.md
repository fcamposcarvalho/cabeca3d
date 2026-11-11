# Pineal, hipófise e o centro da cabeça

Versão atual: v2.1 (10 nov 2026)

Tudo o que criamos na conversa, pronto para rodar no seu computador.

## Estrutura

```
cabeca3d/
├── abrir_modelo3d.py      ← abre o modelo 3D no navegador
├── modelo3d/              ← modelo 3D interativo (HTML + CSS + JavaScript)
│   ├── index.html
│   ├── estilo.css
│   ├── app.js
│   └── vendor/three/      ← biblioteca three.js 0.160 (funciona sem internet)
└── python/
    ├── requirements.txt
    ├── cabeca.py          ← pôster de perfil (PNG + PDF)
    ├── vistas.py          ← pôster de frente e de cima (PNG + PDF)
    ├── modelo.py          ← modelo do relógio e da melatonina
    ├── grafico.py         ← gráfico da melatonina (usa modelo.py)
    └── bezier_anim.py     ← animação da curva de Bézier (GIF)
```

## 1. Instalar o Python

Precisa do Python 3.9 ou mais novo (python.org). Confira no terminal:

```
python --version
```

(No macOS/Linux pode ser `python3` no lugar de `python`.)

## 2. Modelo 3D

Não precisa instalar nada além do Python. Na pasta `cabeca3d`:

```
python abrir_modelo3d.py
```

O terminal mostra o endereço para abrir no notebook (rede local, porta 8002 ou a
próxima livre). Para sair, Ctrl+C.

Opções do script:

| Opção | O que faz |
|---|---|
| `--porta 8080` | começa por outra porta |
| `--local` | só aceita conexões do próprio servidor |
| `--log` | mostra cada acesso no terminal |
| `--sem-qr` | não mostra o QR code |
| `--instalar-servico` | instala um serviço do systemd: o modelo sobe sozinho no boot |
| `--remover-servico` | remove esse serviço |

QR code no terminal (para abrir no celular): `pip install qrcode`.

Serviço automático (Ubuntu): `python abrir_modelo3d.py --instalar-servico`.
Depois: `systemctl --user status modelo3d` e `journalctl --user -u modelo3d -f`.
Se ele pedir, rode uma vez `sudo loginctl enable-linger $USER` para subir no boot
mesmo sem login. Depois de editar os arquivos: `systemctl --user restart modelo3d`.

O que tem no modelo:

- Tour guiado com 14 passos (luz → relógio → medula → pescoço → pineal → hipófise).
- Quiz: a estrutura pisca e você escolhe o nome.
- Modo embrião: os brotos do diencéfalo (retinas, pineal, neuro-hipófise) e a bolsa de Rathke.
- Régua: modo Distância (2 cliques, em cm) ou Ângulo (3 cliques; o ângulo é medido no ponto do meio,
  θ = arccos((A−B)·(C−B) / (|A−B|·|C−B|))). Ex.: glabela → pineal → topo da cabeça ≈ 87,5°.
- Duplo clique numa estrutura (no 3D, no nome ou na bolinha): a câmera voa até ela e para de perto.
- Volumes: a ficha de cada estrutura mostra o volume no modelo (calculado da forma 3D pelo teorema
  da divergência: soma de tetraedros, um por triângulo), o valor real típico de um adulto e o tamanho.
  Botão "esfera de mesmo volume" (d = ∛(6V/π)). Régua com modos Volume (compara duas estruturas)
  e Tetraedro (4 pontos, V = |u·(v×w)|/6). Botão Tamanhos: escala logarítmica do NSQ ao encéfalo.
  Camada Fluxo do líquor: quadro com volumes em mL e contador de produção (≈ 20 mL/h).
  Fontes dos valores reais: pineal (World J Radiol 2013; Sun et al. 2009), hipófise (J Clin Imaging Sci
  2015; HUNT MRI, Pituitary 2021), ventrículos laterais (AJNR, revisão de anatomia: 7 a 10 mL cada), líquor (StatPearls/NCBI,
  "Neuroanatomy, Cerebrospinal Fluid"), tálamo (Neuroimage 2014; PLoS One 2019), cerebelo (J Surg Med 2019; Taman et al. 2019),
  olho (EyeWiki "Eye in Numbers"), NSQ (Swaab, ~0,25 mm³), encéfalo (médias de 1.130 e 1.260 cm³).
- Salvar imagem (PNG da vista atual, com os rótulos) e Copiar imagem (só em https ou localhost),
  na seção Vista.
- Idioma: botões PT / EN no canto do menu; a escolha fica gravada no navegador.
- Corte de perfil, de frente ou de cima, com controle de posição.
- Relógio de 24 h com três rotinas (noite escura, telas na 1ª noite, telas após 2 semanas).
- Camadas: fluxo do líquor, sistema porta, camada simbólica (ajna, coroa, eixo).
- Rótulos que se afastam sozinhos para não se sobrepor.
- Cartões (tour, quiz, embrião, régua) arrastáveis pela barra de cima.
- Rede do NSQ: 200 neurônios-osciladores sincronizando pelo modelo de Kuramoto
  (dθᵢ/dt = ωᵢ + K·r·sin(ψ − θᵢ)), com pulso de luz e ciclo de luz diário.
- Jet lag e turnos: quantos dias o relógio leva para se acertar após viajar
  para leste ou oeste, e o que acontece num turno noturno (óculos escuros, folgas).
- Ritmos do dia inteiro: melatonina, cortisol, temperatura e pressão do sono.
- Pontos de referência (topo e parte de trás da cabeça), rótulos clicáveis,
  menu retrátil (tecla M) e botão "Restaurar padrão".
- Som (começa desligado; tudo gerado no navegador, sem arquivos):
  - Efeitos: timbre por tipo de estrutura ao clicar, quiz (acerto, erro, fanfarra),
    régua sonora (perto = agudo, longe = grave), circuito audível (pings de luz,
    estalidos nervosos, gotas de melatonina) e embrião com batimento cardíaco.
  - Voz em português: nomes ao clicar, narração do tour e tour que avança sozinho.
    No Windows, as vozes "Natural/Online" do Edge são as mais naturais.
  - Ambiente: brisa e pássaros de dia, grilos à noite, zumbido das telas,
    líquor pulsando no ritmo do coração e melodia da melatonina.

Por que o servidor? Os navegadores não carregam módulos JavaScript abertos com
duplo clique (file://).

Para editar: cores e layout em `estilo.css`; estruturas, rótulos, textos, tour,
quiz e relógio em `app.js` (as coordenadas estão em cm, com origem na raiz do nariz).

## 3. Scripts em Python

```
cd python
pip install -r requirements.txt
python cabeca.py
python vistas.py
python grafico.py
python bezier_anim.py
```

Cada script salva as imagens na própria pasta `python/`.

## Observações

- Proporções aproximadas de um adulto; esquema didático.
- O modelo da melatonina é ilustrativo, não clínico.
- O eixo vertical e o "terceiro olho" são leituras simbólicas.
