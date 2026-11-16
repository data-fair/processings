// copy of the reading rule of { en, fr } registry values, see https://github.com/data-fair/registry/blob/main/ui/src/utils/localized.ts

type LocalizedText = { fr?: string, en?: string }

export const localizedText = (value: LocalizedText | undefined, lang: string | undefined): string | undefined => {
  if (!value) return undefined
  return lang?.startsWith('fr') ? (value.fr || value.en || undefined) : (value.en || value.fr || undefined)
}

export default localizedText
