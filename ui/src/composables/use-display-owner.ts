// A department deleted in simple-directory keeps its id on the resources it owned, but not its name:
// the identity webhook removed it. Build the owner as it must be displayed (owner-avatar, labels).
import { useI18n } from 'vue-i18n'

type Owner = { department?: string, departmentName?: string, [key: string]: unknown }

export const useDisplayOwner = () => {
  const { t } = useI18n({
    useScope: 'local',
    messages: {
      fr: { formerDepartment: 'Ancien département - {id}' },
      en: { formerDepartment: 'Former department - {id}' }
    }
  })

  const departmentLabel = (department?: string, departmentName?: string) => {
    if (!department) return undefined
    return departmentName || t('formerDepartment', { id: department })
  }

  const displayOwner = <T extends Owner>(owner: T): T => {
    if (!owner.department || owner.departmentName) return owner
    return { ...owner, departmentName: departmentLabel(owner.department) }
  }

  return { displayOwner, departmentLabel }
}
