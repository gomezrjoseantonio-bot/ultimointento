// Helper compartido para opciones de Intl.NumberFormat / toLocaleString.
//
// La lib estándar (lib.es5.d.ts) declara `useGrouping?: boolean` y los
// literales `'always' | 'auto' | 'min2'` introducidos en ES2023 todavía no
// existen en la versión de TypeScript del proyecto (4.9). Para no repetir
// `as Intl.NumberFormatOptions` en cada formatter, exponemos:
//
//   · `NumberFormatOptionsExt` · tipo de opciones con `useGrouping` ampliado.
//   · `intlOpts(...)`         · adapta `NumberFormatOptionsExt` al tipo
//                                que aceptan los runtimes (cast localizado).
//
// Necesario porque es-ES, por defecto, omite el separador de millares en
// cifras de 4 dígitos (minimumGroupingDigits=2): "4473" en vez de "4.473".

export type NumberFormatOptionsExt = Omit<Intl.NumberFormatOptions, 'useGrouping'> & {
  useGrouping?: 'always' | 'auto' | 'min2' | boolean;
};

export const intlOpts = (
  options: NumberFormatOptionsExt,
): Intl.NumberFormatOptions => options as unknown as Intl.NumberFormatOptions;
