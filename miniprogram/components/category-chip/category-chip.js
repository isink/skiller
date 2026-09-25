const format = require('../../utils/format')

Component({
  options: { addGlobalClass: true },

  properties: {
    label: { type: String, value: '' },
    count: { type: Number, value: -1 },
    active: { type: Boolean, value: false },
    value: { type: String, value: '' },
  },

  data: { countText: '' },

  observers: {
    count(n) {
      this.setData({ countText: n >= 0 ? format.count(n) : '' })
    },
  },

  methods: {
    onTap() {
      this.triggerEvent('select', { value: this.data.value })
    },
  },
})
