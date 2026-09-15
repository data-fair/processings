// A department deleted in simple-directory keeps its id on the resources it owned, but not its name:
// the identity webhook removed it. Build the owner as it must be displayed (owner-avatar, labels).
import { useI18n } from 'vue-i18n'

type Owner = { department?: string, departmentName?: string, [key: string]: unknown }

// plain strings: the runtime-only vue-i18n build used in production cannot compile inline messages
const formerDepartment: Record<string, string> = {
  fr: 'Ancien département',
  en: 'Former department'
}

export const useDisplayOwner = () => {
  const { locale } = useI18n()

  const departmentLabel = (department?: string, departmentName?: string) => {
    if (!department) return undefined
    return departmentName || `${formerDepartment[locale.value] ?? formerDepartment.en} - ${department}`
  }

  const displayOwner = <T extends Owner>(owner: T): T => {
    if (!owner.department || owner.departmentName) return owner
    return { ...owner, departmentName: departmentLabel(owner.department) }
  }

  return { displayOwner, departmentLabel }
}
