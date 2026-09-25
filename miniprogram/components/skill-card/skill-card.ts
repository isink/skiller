import * as favorites from '../../utils/favorites'
import { present } from '../../utils/skill'
import { dict } from '../../utils/i18n'
import { Skill, SkillCardViewModel } from '../../utils/types'

let unsubscribers: Record<string, () => void> = {}
let nextId = 0

Component({
  options: { addGlobalClass: true },

  properties: {
    skill: { type: Object, value: {} },
  },

  data: {
    vm: null as SkillCardViewModel | null,
    favorited: false,
    t: dict(),
    uid: '',
  },

  observers: {
    skill(skill: Skill) {
      if (!skill || !skill.id) return
      this.setData({ vm: present(skill), favorited: favorites.has(skill.id) })
    },
  },

  lifetimes: {
    attached() {
      const uid = String(++nextId)
      this.setData({ uid })
      unsubscribers[uid] = favorites.subscribe(() => this.refreshFavorite())
    },
    detached() {
      const off = unsubscribers[this.data.uid]
      if (off) off()
      delete unsubscribers[this.data.uid]
    },
  },

  pageLifetimes: {
    show() { this.refreshFavorite() },
  },

  methods: {
    current(): Skill | null {
      const skill = this.data.skill as unknown as Skill
      return skill && skill.id ? skill : null
    },

    refreshFavorite() {
      const skill = this.current()
      if (!skill) return
      const favorited = favorites.has(skill.id)
      if (favorited !== this.data.favorited) this.setData({ favorited })
    },

    onTap() {
      const skill = this.current()
      if (skill) wx.navigateTo({ url: '/pages/detail/detail?id=' + skill.id })
    },

    onToggleFavorite() {
      const skill = this.current()
      if (!skill) return
      wx.vibrateShort({ type: 'light', fail() { /* 部分设备不支持 */ } })
      this.setData({ favorited: favorites.toggle(skill.id, skill) })
    },
  },
})
