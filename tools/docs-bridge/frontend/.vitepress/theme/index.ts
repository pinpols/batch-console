import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { publicationRedirect } from './publicationNavigation.mjs'
import './custom.css'

export default {
  extends: DefaultTheme,
  setup() {
    const { frontmatter } = useData()
    const redirect = () => {
      if (typeof window === 'undefined') return
      const target = publicationRedirect(
        frontmatter.value.publicationRedirects,
        window.location.pathname,
        window.location.hash,
        window.location.search,
      )
      if (target) window.location.replace(new URL(target, window.location.href).href)
    }
    onMounted(() => {
      redirect()
      window.addEventListener('hashchange', redirect)
    })
    onUnmounted(() => window.removeEventListener('hashchange', redirect))
    watch(
      () => frontmatter.value.publicationRedirects,
      () => {
        void nextTick(redirect)
      },
      { flush: 'post' },
    )
  },
}
