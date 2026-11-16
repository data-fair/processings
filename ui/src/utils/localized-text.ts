type LocalizedText = { fr?: string, en?: string }

/**
 * text of a { en, fr } value stored by the registry (plugin title, description, group)
 * French sessions read the French text, every other session language reads the English one,
 * each falling back on the other language
 */
export const localizedText = (value: LocalizedText | undefined, lang: string | undefined): string | undefined => {
  if (!value) return undefined
  return lang?.startsWith('fr') ? (value.fr || value.en || undefined) : (value.en || value.fr || undefined)
}

export default localizedText
