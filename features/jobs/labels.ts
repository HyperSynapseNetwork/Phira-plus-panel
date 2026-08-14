import type { DomainTranslator } from '~/features/common/domain-label'
import { localizedDomainValue } from '~/features/common/domain-label'

export const jobStateLabel = (t: DomainTranslator, value: string | null | undefined) => localizedDomainValue(t, 'jobState', value)
export const jobTypeLabel = (t: DomainTranslator, value: string | null | undefined) => localizedDomainValue(t, 'jobType', value)
export const jobStageLabel = (t: DomainTranslator, value: string | null | undefined) => localizedDomainValue(t, 'jobStage', value)
