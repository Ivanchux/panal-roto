# Cómo subir Panal Roto a itch.io (sin publicarlo)

Esto deja el juego como **borrador**. No se publica hasta que tú lo decidas.

## 1. Generar el .zip
Desde la carpeta del repositorio:

```bash
node tools/build-dist.mjs
```

Crea `dist/` y `panal-roto-html5.zip` (unos 40 KB). El script se detiene si encuentra direcciones externas en `index.html`.

## 2. Crear el proyecto en itch.io
1. Entra en itch.io → **Dashboard** → **Create new project**.
2. **Title:** copia `itch/titulo.txt`.
3. **Short description or tagline:** copia `itch/descripcion_corta.txt`.
4. **Kind of project:** elige **HTML**.
5. **Uploads:** sube `panal-roto-html5.zip` y marca **This file will be played in the browser**.
6. **Embed options:** pon el tamaño del visor que indica `itch/ajustes_embed.txt` (800 × 700), activa **Fullscreen button** y marca **Mobile friendly**.
7. **Description:** pega el contenido de `itch/descripcion.md`.
8. **Genre:** `itch/genero.txt`. **Tags:** hasta diez, desde `itch/etiquetas.txt`.
9. **Cover image:** `itch/portada-630x500.png`. **Screenshots:** las de `itch/capturas/`.
10. **Pricing:** elige lo que prefieras (el juego no tiene anuncios ni compras).
11. **Visibility:** deja **Draft** y pulsa **Save**.

## 3. Antes de publicar, comprueba
- Abre la vista previa del borrador y juega una partida: pausa con `P`, silencia con `M` y prueba la pantalla completa con `F`.
- Pruébalo también desde el móvil con el enlace privado del borrador.
- Revisa los textos de `itch/`: están escritos solo con lo que el juego hace, y los cambias tú como quieras.

## 4. Licencia
El repositorio usa PolyForm Noncommercial 1.0.0. Eres tú quien publica tu propio juego, así que no hay conflicto, pero conviene que indiques en la página qué se puede hacer con él. Itch.io no tiene esa licencia entre sus opciones predefinidas: usa la opción de licencia personalizada o enlaza al `LICENSE` del repositorio.

## No he podido probar
Safari en iPhone, el audio real y el rendimiento en móviles reales.
