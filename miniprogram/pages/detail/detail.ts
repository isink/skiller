import * as api from '../../utils/api'
import * as cache from '../../utils/cache'
import * as favorites from '../../utils/favorites'
import * as recents from '../../utils/recents'
import * as format from '../../utils/format'
import * as skillUtil from '../../utils/skill'
import { RichNode, toNodes } from '../../utils/markdown'
import { dict, t } from '../../utils/i18n'
import { Skill, SkillCardViewModel, SkillDetail } from '../../utils/types'

type Status = 'loading' | 'ready' | 'notFound' | 'error'

let current: Skill | null = null
let renderedMarkdown = ''
let sourceTimer = 0
let rawTimer = 0

Page({
  data: {
    t: dict(),
    id: '',
    status: 'loading' as Status,
    vm: null as SkillCardViewModel | null,
    categoryName: '',
    tags: [] as string[],
    sourceURL: '',
    nodes: [] as RichNode[],
    hasMarkdown: false,
    markdownPending: false,
    favorited: false,
    copiedSource: false,
    copiedRaw: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    const id = options.id || ''
    current = null
    renderedMarkdown = ''
    this.setData({ id, favorited: favorites.has(id) })
    if (!api.isSkillId(id)) {
      this.setData({ status: 'notFound' })
      return
    }
    this.load()
  },

  onShow() {
    if (this.data.id) this.setData({ favorited: favorites.has(this.data.id) })
  },

  onUnload() {
    clearTimeout(sourceTimer)
    clearTimeout(rawTimer)
  },

  onShareAppMessage() {
    const vm = this.data.vm
    return {
      title: vm ? vm.name + ' · Skiller' : 'Skiller',
      path: '/pages/detail/detail?id=' + this.data.id,
    }
  },

  onShareTimeline() {
    const vm = this.data.vm
    return { title: vm ? vm.name + ' · Skiller' : 'Skiller', query: 'id=' + this.data.id }
  },

  apply(skill: Skill, complete: boolean) {
    current = skill
    const md = (skill as SkillDetail).skill_md_content || ''
    const patch: Record<string, unknown> = {
      status: 'ready',
      vm: skillUtil.present(skill),
      categoryName: format.categoryName(skill.category),
      tags: skillUtil.displayTags(skill),
      sourceURL: skillUtil.githubRepositoryURL(skill.github_url) || '',
      hasMarkdown: !!md,
      // 列表缓存里的记录没有 SKILL.md，完整记录回来之前显示占位
      markdownPending: !complete && !md,
    }
    if (md && md !== renderedMarkdown) {
      renderedMarkdown = md
      patch.nodes = toNodes(skillUtil.stripFrontmatter(md))
    }
    this.setData(patch)
    wx.setNavigationBarTitle({ title: skill.name })
  },

  load() {
    const { stale, fresh } = cache.skillById(this.data.id)
    if (stale) this.apply(stale, false)
    else this.setData({ status: 'loading' })

    fresh.then((res) => {
      if (res.value) {
        this.apply(res.value, true)
        recents.record(res.value.id, res.value.category)
        favorites.refreshSnapshots([res.value])
      } else if (res.error) {
        // 网络失败：已有列表数据就继续展示，否则给出可重试的错误
        if (current) this.setData({ markdownPending: false })
        else this.setData({ status: 'error' })
        if (current) wx.showToast({ title: t('networkError'), icon: 'none' })
      } else {
        this.setData({ status: 'notFound' })
      }
    })
  },

  onRetry() {
    this.load()
  },

  onToggleFavorite() {
    wx.vibrateShort({ type: 'light', fail() { /* 部分设备不支持 */ } })
    this.setData({ favorited: favorites.toggle(this.data.id, current) })
  },

  copy(text: string, flag: 'copiedSource' | 'copiedRaw') {
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.hideToast()
        this.setData({ [flag]: true })
        const reset = setTimeout(() => this.setData({ [flag]: false }), 1600) as unknown as number
        if (flag === 'copiedSource') { clearTimeout(sourceTimer); sourceTimer = reset } else { clearTimeout(rawTimer); rawTimer = reset }
      },
      fail: () => wx.showToast({ title: t('copyFailed'), icon: 'none' }),
    })
  },

  onCopySource() {
    if (this.data.sourceURL) this.copy(this.data.sourceURL, 'copiedSource')
  },

  onCopyMarkdown() {
    const md = current && (current as SkillDetail).skill_md_content
    if (md) this.copy(md, 'copiedRaw')
  },
})
