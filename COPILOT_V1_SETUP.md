# Atlas Copilot v1 (IA gratuita)

Esta versión integra un copiloto conversacional usando Netlify Functions + OpenRouter (modelos free).

## Variables de entorno

Configura estas variables en Netlify (Site settings > Environment variables):

- `OPENROUTER_API_KEY` (obligatoria)
- `OPENROUTER_MODEL` (opcional)
  - valor recomendado inicial: `meta-llama/llama-3.1-8b-instruct:free`
- `SITE_URL` (opcional, para cabecera referer)

## Endpoint

- `POST /.netlify/functions/copilot-chat`

Body:

```json
{
  "message": "¿Cómo optimizo mi liquidez este mes?",
  "history": [{ "role": "user", "content": "..." }],
  "context": {
    "userName": "Ana",
    "goals": ["Ahorrar", "Reducir deuda"],
    "monthlyIncome": 3000,
    "monthlyExpenses": 2200,
    "language": "es"
  }
}
```

## Frontend

- Servicio: `src/services/copilotService.ts`
- Widget UI: `src/components/common/CopilotWidget.tsx`
- Integración global: `src/App.tsx`

## Notas de seguridad

- La API key vive solo en backend (`functions/copilot-chat.ts`).
- No enviar PII innecesaria al prompt.
- La respuesta incluye advertencia de uso informativo.
