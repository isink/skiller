const i18n = require('../../utils/i18n')

Component({
  options: { addGlobalClass: true },

  properties: {
    page: { type: Number, value: 0 }, // 从 0 开始
    total: { type: Number, value: 1 },
  },

  data: { label: '' },

  observers: {
    'page, total'(page, total) {
      this.setData({ label: i18n.t('pageOf', page + 1, total) })
    },
  },

  methods: {
    onPrev() {
      if (this.data.page > 0) this.triggerEvent('change', { page: this.data.page - 1 })
    },
    onNext() {
      if (this.data.page < this.data.total - 1) this.triggerEvent('change', { page: this.data.page + 1 })
    },
  },
})
