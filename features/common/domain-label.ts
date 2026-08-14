export type DomainTranslator = (key: string) => string

export function localizedDomainValue(t: DomainTranslator, domain: string, value: string | null | undefined): string {
  if (!value)
    return t('common.unknown')
  const key = `domainValues.${domain}.${value}`
  const translated = t(key)
  return translated === key ? `${t('common.unknown')} (${value})` : translated
}
