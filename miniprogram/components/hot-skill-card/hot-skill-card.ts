import { present } from '../../utils/skill'
import { Skill, SkillCardViewModel } from '../../utils/types'

const PALETTE: Record<string, [string, string]> = {
  official: ['#2A1E14', '#D97757'],
  code: ['#111C2A', '#5B9BD5'],
  devops: ['#141F14', '#5EC97A'],
  data: ['#1E1428', '#9B6FD4'],
  design: ['#28141E', '#D46F9B'],
  docs: ['#141F1F', '#3DBDBD'],
  office: ['#1F1F14', '#BDBD3D'],
  research: ['#141C28', '#5B9BD5'],
  misc: ['#1A1A1A', '#6B6B78'],
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')'
}

Component({
  options: { addGlobalClass: true },

  properties: {
    skill: { type: Object, value: {} },
  },

  data: {
    vm: null as SkillCardViewModel | null,
    bg: '',
    accent: '',
    accentSoft: '',
    kicker: '',
  },

  observers: {
    skill(skill: Skill) {
      if (!skill || !skill.id) return
      const vm = present(skill)
      const [bg, accent] = PALETTE[skill.category] || PALETTE.misc
      this.setData({ vm, bg, accent, accentSoft: rgba(accent, 0.14), kicker: '@' + vm.authorName + ' · ' + vm.timeAgo })
    },
  },

  methods: {
    onTap() {
      const vm = this.data.vm
      if (vm) wx.navigateTo({ url: '/pages/detail/detail?id=' + vm.id })
    },
  },
})
