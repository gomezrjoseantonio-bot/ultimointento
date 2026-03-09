# Bank Profiles Input Directory

Coloca aquí tus archivos reales de extractos bancarios para generar perfiles automáticamente.

## Formatos soportados
- CSV (.csv)
- Excel (.xlsx, .xls)

## Uso
1. Copia archivos reales (anonimizados si es necesario) en esta carpeta
2. Ejecuta: `yarn build:bank-profiles`
3. Sigue las instrucciones interactivas
4. El script generará `public/assets/bank-profiles.json`

## Ejemplo de estructura
```
profiles-input/
├── ING.xlsx
├── BBVA.csv
├── Santander.xlsx
├── Unicaja.csv
└── ...
```

## Notas
- Un archivo por banco/entidad
- Los archivos pueden estar anonimizados (datos reales no son necesarios)
- Solo se necesitan las cabeceras y algunas filas de ejemplo