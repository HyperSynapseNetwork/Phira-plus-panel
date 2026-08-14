import type { DomainTranslator } from '~/features/common/domain-label'
import { localizedDomainValue } from '~/features/common/domain-label'
export const commandStatusLabel = (t: DomainTranslator, value: string | null | undefined) => localizedDomainValue(t, 'commandStatus', value)
