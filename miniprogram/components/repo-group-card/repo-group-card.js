const cache = require('../../utils/cache')
const format = require('../../utils/format')
const i18n = require('../../utils/i18n')

Component({
  options: { addGlobalClass: true },

  properties: {
    group: { type: Object, value: null },
  },

  data: {
    codeIcon: '</>',
    stars: '',
    meta: '',
    expanded: false,
    loading: false,
    skills: null,
  },

  observers: {
    group(g) {
      if (!g) return
      this.setData({
        stars: format.stars(g.stars),
        meta: i18n.t('repoSkillCount', format.author(g.author), g.skill_count),
      })
    },
  },

  methods: {
    onToggle() {
      const expanded = !this.data.expanded
      this.setData({ expanded })
      if (!expanded || this.data.skills || this.data.loading) return

      const { stale, fresh } = cache.skillsInRepo(this.data.group.repo)
      if (stale) this.setData({ skills: stale })
      else this.setData({ loading: true })
      fresh.then((v) => {
        this.setData(v ? { skills: v, loading: false } : { loading: false })
      })
    },
  },
})
