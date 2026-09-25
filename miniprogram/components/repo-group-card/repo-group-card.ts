import * as cache from '../../utils/cache'
import * as format from '../../utils/format'
import { t } from '../../utils/i18n'
import { RepoGroup, SkillListItem } from '../../utils/types'

Component({
  options: { addGlobalClass: true },

  properties: {
    group: { type: Object, value: {} },
  },

  data: {
    codeIcon: '</>',
    stars: '',
    meta: '',
    expanded: false,
    loading: false,
    loadError: false,
    retryText: t('networkError'),
    skills: null as SkillListItem[] | null,
  },

  observers: {
    group(g: RepoGroup) {
      if (!g || !g.repo) return
      this.setData({
        stars: format.stars(g.stars),
        meta: t('repoSkillCount', format.author(g.author), g.skill_count),
      })
    },
  },

  methods: {
    onToggle() {
      const expanded = !this.data.expanded
      this.setData({ expanded })
      if (expanded && !this.data.skills && !this.data.loading) this.load()
    },

    load() {
      const group = this.data.group as unknown as RepoGroup
      const { stale, fresh } = cache.skillsInRepo(group.repo)
      this.setData(stale ? { skills: stale, loadError: false } : { loading: true, loadError: false })
      fresh.then((res) => {
        if (res.value) this.setData({ skills: res.value, loading: false })
        else this.setData({ loading: false, loadError: res.error && !this.data.skills })
      })
    },
  },
})
