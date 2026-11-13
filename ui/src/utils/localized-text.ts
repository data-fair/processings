type LocalizedText = { fr?: string, en?: string }

/** text of a { en, fr } value in the session language, falling back on the other language */
export const localizedText = (value: LocalizedText | undefined, lang: string | undefined): string | undefined => {
  if (!value) return undefined
  return lang === 'en' ? (value.en ?? value.fr) : (value.fr ?? value.en)
}

export default localizedText
