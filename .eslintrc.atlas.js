module.exports = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/text-(blue|green|red|yellow|gray)-(\\d00)/]',
        message: 'No usar clases Tailwind de colores. Usar tokens ATLAS (text-atlas-blue, text-ok, etc.)'
      },
      {
        selector: 'Literal[value=/bg-(blue|green|red|yellow|indigo|purple)-(\\d00)/]',
        message: 'No usar clases Tailwind de backgrounds. Usar tokens ATLAS.'
      },
    ]
  }
};
