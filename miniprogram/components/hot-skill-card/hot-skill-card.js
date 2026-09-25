const skillUtil = require('../../utils/skill')

const PALETTE = {
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

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')'
}

Component({
  options: { addGlobalClass: true },

  properties: {
    skill: { type: Object, value: null },
  },

  data: { vm: null, bg: '', accent: '', accentSoft: '', kicker: '' },

  observers: {
    skill(skill) {
      if (!skill) return
      const vm = skillUtil.present(skill)
      const [bg, accent] = PALETTE[skill.category] || PALETTE.misc
      this.setData({ vm, bg, accent, accentSoft: rgba(accent, 0.14), kicker: '@' + vm.authorName + ' · ' + vm.timeAgo })
    },
  },

  methods: {
    onTap() {
      const skill = this.data.skill
      if (skill) wx.navigateTo({ url: '/pages/detail/detail?id=' + skill.id })
    },
  },
})
