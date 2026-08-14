import type { DomainTranslator } from '~/features/common/domain-label'
import { localizedDomainValue } from '~/features/common/domain-label'

export const redemptionStatusLabel = (t: DomainTranslator, value: string | null | undefined) => localizedDomainValue(t, 'redemptionStatus', value)
export const redemptionTaskStatusLabel = (t: DomainTranslator, value: string | null | undefined) => localizedDomainValue(t, 'redemptionTaskStatus', value)
export const redemptionActionTypeLabel = (t: DomainTranslator, value: string | null | undefined) => localizedDomainValue(t, 'redemptionActionType', value)
