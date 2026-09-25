const favorites = require('../../utils/favorites')
const skillUtil = require('../../utils/skill')
const i18n = require('../../utils/i18n')

Component({
  options: { addGlobalClass: true },

  properties: {
    skill: { type: Object, value: null },
  },

  data: {
    vm: null,
    favorited: false,
    t: i18n.dict(),
  },

  observers: {
    skill(skill) {
      if (!skill) return
      this.setData({ vm: skillUtil.present(skill), favorited: favorites.has(skill.id) })
    },
  },

  lifetimes: {
    attached() {
      this.unsubscribe = favorites.subscribe(() => this.refreshFavorite())
    },
    detached() {
      if (this.unsubscribe) this.unsubscribe()
    },
  },

  pageLifetimes: {
    show() { this.refreshFavorite() },
  },

  methods: {
    refreshFavorite() {
      const skill = this.data.skill
      if (!skill) return
      const favorited = favorites.has(skill.id)
      if (favorited !== this.data.favorited) this.setData({ favorited })
    },

    onTap() {
      const skill = this.data.skill
      if (skill) wx.navigateTo({ url: '/pages/detail/detail?id=' + skill.id })
    },

    onToggleFavorite() {
      const skill = this.data.skill
      if (!skill) return
      wx.vibrateShort && wx.vibrateShort({ type: 'light', fail() {} })
      this.setData({ favorited: favorites.toggle(skill.id) })
    },
  },
})
