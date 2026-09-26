# content/ — textos e dados do jogo

São os arquivos que o editor (`/admin`) altera. O jogo lê `bundle.js`, **gerado** por `npm run build` a partir dos JSON (com validação).

| Item | O que é |
|---|---|
| `cases/`, `secret/` | os 15 pacientes e os 3 visitantes do modo secreto |
| `index.json` | lista de casos |
| `manual.json`, `approaches.json` | o Manual de diagnósticos e as abordagens |
| `dx.json` | banco da investigação clínica (**gerado** por `tools/python/build_dx.py`) |
| `world.json` | lugares, ruas, pessoas e cartões de aprendizagem (ruas e lugares novos: `build_streets.py` e `build_places.py`) |
| `shop.json`, `pets.json`, `pins.json`, `schedule.json` | loja, bichinhos, botons/bandeiras, agenda |
| `bundle.js` | **GERADO**. Não edite |
