#!/bin/sh
# Ejecuta toda la batería desde la raíz del repositorio. Necesita Node 18+, Python 3 con Playwright y Chromium.
set -e
echo "== Motor: piezas, líneas, derrumbe"; node pruebas/motor.test.mjs
echo "== Reglas: gravedad, bloqueo, empujes, fantasma, puntuación"; node pruebas/reglas.test.mjs
echo "== Bots con semilla fija (aleatorio + heurístico)"; node pruebas/bots.mjs fuzz=3000 smart=150 maxp=400
echo "== Determinismo (Node)"; node pruebas/hash-cruzado.mjs
echo "== Paleta para daltónicos"; node pruebas/paleta-daltonismo.mjs | head -2
echo "== Navegador: modos, ajustes, entradas, fin de partida, mando, táctil, determinismo cruzado, rendimiento"; python3 pruebas/navegador-completo.py
echo "== Audio real en Chromium"; python3 pruebas/audio-navegador.py
