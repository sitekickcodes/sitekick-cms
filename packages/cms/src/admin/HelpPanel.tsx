'use client'

import { useDeferredValue, useId, useRef, useState } from 'react'
import { Popup, PopupList, useConfig } from '@payloadcms/ui'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'

import { findArticle, HELP_PARAM, searchArticles, type HelpArticle } from '../help/shared'
import {
  ArrowLeftIcon,
  BookIcon,
  ChevronDownIcon,
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  ExternalIcon,
  InfoIcon,
  PanelIcon,
  SearchIcon,
} from './HelpIcons'
import styles from './Help.module.css'

const ALL_TOPICS = 'All topics'

type Props = {
  initialArticle?: string
  articles: HelpArticle[]
  loading?: boolean
  error?: boolean
  preview?: boolean
  onRetry?: () => void
  expanded: boolean
  onToggleExpanded: () => void
  onMinimize?: () => void
}

/**
 * The drawer's contents: search, a topic filter, the directory, one article
 * with its related reads, and a copyable link. Navigation here never
 * touches the editor's router, URL, form state or unsaved-change guard;
 * a hidden drawer stays mounted so the reader keeps their place.
 */
export function HelpPanel({ initialArticle, articles, loading, error, preview, onRetry, expanded, onToggleExpanded, onMinimize }: Props) {
  const { config } = useConfig()
  const adminRoute = config.routes.admin
  const [articleId, setArticleId] = useState<string | null>(initialArticle ?? null)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [topic, setTopic] = useState(ALL_TOPICS)
  const [trail, setTrail] = useState<{ articleId: string | null; query: string; topic: string }[]>([])
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const id = useId()

  const article = articleId ? findArticle(articles, articleId) : null
  const searching = query.trim().length > 0
  const results = searchArticles(articles, deferredQuery).filter((item) => topic === ALL_TOPICS || item.topic === topic)
  const topics = [...new Set(articles.map((item) => item.topic))]

  const resetCopy = () => {
    setCopied(false)
    setCopyFailed(false)
  }
  const openArticle = (next: string | null) => {
    setTrail((previous) => [...previous, { articleId, query, topic }])
    setArticleId(next)
    setNavigationOpen(false)
    setQuery('')
    resetCopy()
    scroll.current?.scrollTo({ top: 0 })
    // The heading is stable across articles, so keyboard users land on the
    // new content without a delayed focus timer.
    title.current?.focus({ preventScroll: true })
  }
  const back = () => {
    const previous = trail.at(-1)
    setArticleId(previous?.articleId ?? null)
    setTrail((items) => items.slice(0, -1))
    setQuery(previous?.query ?? '')
    setTopic(previous?.topic ?? ALL_TOPICS)
    resetCopy()
    scroll.current?.scrollTo({ top: 0 })
    title.current?.focus({ preventScroll: true })
  }
  const showAll = () => {
    setTopic(ALL_TOPICS)
    openArticle(null)
  }
  const articleURL = `${adminRoute}?${HELP_PARAM}=${article && !searching ? article.id : 'all'}`
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(articleURL, window.location.origin).href)
      setCopied(true)
      setCopyFailed(false)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <div className={`${styles.root} ${styles.inDrawer} ${expanded ? styles.expandedPanel : ''}`}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <span className={styles.wordmark}>
            <BookIcon size={19} aria-hidden /> Help
          </span>
          <div className={styles.tools}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={onToggleExpanded}
              aria-label={expanded ? 'Collapse help' : 'Expand help'}
              aria-expanded={expanded}
              title={expanded ? 'Collapse help' : 'Expand help'}
            >
              {expanded ? <CollapseIcon aria-hidden /> : <ExpandIcon aria-hidden />}
            </button>
            {onMinimize ? (
              <button type="button" className={styles.iconButton} onClick={onMinimize} aria-label="Close help" title="Close help">
                <CloseIcon aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        <label className={styles.search} htmlFor={`${id}-search`}>
          <SearchIcon aria-hidden />
          <input
            ref={search}
            id={`${id}-search`}
            type="search"
            placeholder="Search help"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setTopic(ALL_TOPICS)
              scroll.current?.scrollTo({ top: 0 })
            }}
            aria-label="Search all help articles"
          />
          <button
            type="button"
            className={styles.clearSearch}
            disabled={!query}
            aria-hidden={!query}
            aria-label="Clear search"
            onClick={() => {
              setQuery('')
              search.current?.focus({ preventScroll: true })
            }}
          >
            <CloseIcon size={16} aria-hidden />
          </button>
        </label>
        {expanded && article && !searching ? (
          <button
            type="button"
            className={styles.navigationToggle}
            aria-expanded={navigationOpen}
            aria-controls={`${id}-navigation`}
            onClick={() => setNavigationOpen((value) => !value)}
          >
            <PanelIcon aria-hidden /> Browse articles
          </button>
        ) : null}
      </header>
      <div className={styles.body}>
        <nav
          id={`${id}-navigation`}
          className={`${styles.navigation} ${navigationOpen ? styles.navigationOpen : ''}`}
          aria-label="Help articles"
          hidden={!expanded || !article || searching}
        >
          <button type="button" aria-current={!article && !searching ? 'page' : undefined} onClick={showAll}>
            All articles
          </button>
          {topics.map((group) => (
            <section key={group}>
              <h2>{group}</h2>
              {articles
                .filter((item) => item.topic === group)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={articleId === item.id && !searching ? 'page' : undefined}
                    onClick={() => openArticle(item.id)}
                  >
                    {item.title}
                  </button>
                ))}
            </section>
          ))}
        </nav>
        <div ref={scroll} className={styles.scroll}>
          <div className={styles.content}>
            {article && !searching ? (
              <nav className={styles.breadcrumb} aria-label="Article navigation">
                <button type="button" onClick={back}>
                  <ArrowLeftIcon size={14} aria-hidden /> Back
                </button>
                <button type="button" className={styles.allArticles} onClick={showAll}>
                  All articles
                </button>
              </nav>
            ) : null}
            <div className={`${styles.titleRow} ${searching ? styles.searchTitleRow : ''}`}>
              <h1 ref={title} tabIndex={-1} className={`${styles.title} ${!article && !searching ? styles.directoryTitle : ''}`}>
                {searching ? 'Search results' : (article?.title ?? 'Articles')}
              </h1>
              {!article && !searching && topics.length ? (
                <div className={styles.filter}>
                  <Popup
                    horizontalAlign="right"
                    size="fit-content"
                    popupAriaLabel="Filter by topic"
                    buttonType="custom"
                    button={
                      <span role="button" className={styles.topicTrigger} aria-label={`Filter by topic: ${topic}`}>
                        {topic}
                        <ChevronDownIcon size={14} aria-hidden />
                      </span>
                    }
                    render={({ close }) => (
                      <PopupList.RadioGroup>
                        {[ALL_TOPICS, ...topics].map((choice) => (
                          <PopupList.RadioGroupItem
                            key={choice}
                            active={choice === topic}
                            onClick={() => {
                              setTopic(choice)
                              scroll.current?.scrollTo({ top: 0 })
                              close()
                            }}
                          >
                            {choice}
                          </PopupList.RadioGroupItem>
                        ))}
                      </PopupList.RadioGroup>
                    )}
                  />
                </div>
              ) : null}
            </div>

            {preview ? (
              <p className={styles.meta} role="status">
                Preview. Unpublished changes are visible here.
              </p>
            ) : null}
            {loading ? (
              <p className={styles.meta} role="status">
                Loading articles…
              </p>
            ) : error ? (
              <div className={styles.empty} role="status">
                <p>Help could not load. Please try again.</p>
                <button type="button" className={styles.textButton} onClick={onRetry}>
                  Try again
                </button>
              </div>
            ) : searching || !article ? (
              <>
                {articleId && !searching ? (
                  <p className={styles.meta} role="status">
                    This article is no longer available. Choose another below.
                  </p>
                ) : null}
                {!searching && articles.length === 0 ? <p className={styles.meta}>No articles have been published yet.</p> : null}
                {searching ? (
                  <p className={styles.meta} role="status">
                    {results.length} {results.length === 1 ? 'article' : 'articles'} found.
                  </p>
                ) : null}
                {searching ? (
                  <ArticleRows articles={results} onOpen={openArticle} />
                ) : (
                  <div className={styles.directory}>
                    {topics
                      .filter((group) => results.some((item) => item.topic === group))
                      .map((group) => (
                        <section key={group} className={styles.group}>
                          <h2>{group}</h2>
                          <ArticleRows articles={results.filter((item) => item.topic === group)} onOpen={openArticle} />
                        </section>
                      ))}
                  </div>
                )}
                {results.length === 0 && articles.length > 0 ? (
                  <div className={styles.empty}>
                    <p>No articles match that search.</p>
                    <p>Try a shorter term, such as a single word.</p>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => {
                        setQuery('')
                        setTopic(ALL_TOPICS)
                        search.current?.focus()
                      }}
                    >
                      Clear search
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <article className={styles.article} aria-label={article.title}>
                  <RichText data={article.body} converters={converters} />
                </article>
                {article.related.length ? (
                  <section className={styles.related} aria-label="Related articles">
                    <h2>Related articles</h2>
                    {article.related.map((relatedId) => {
                      const item = findArticle(articles, relatedId)
                      return item ? (
                        <button type="button" key={item.id} onClick={() => openArticle(item.id)}>
                          {item.title}
                          <ChevronDownIcon className={styles.rowArrow} size={14} aria-hidden />
                        </button>
                      ) : null
                    })}
                  </section>
                ) : null}
              </>
            )}
            {article && !searching ? (
              <footer className={styles.footer}>
                <button type="button" onClick={copyLink} className={styles.textButton}>
                  {copied ? 'Link copied' : 'Copy article link'}
                </button>
              </footer>
            ) : null}
            {copied ? (
              <span className={styles.srOnly} role="status">
                Article link copied to clipboard.
              </span>
            ) : null}
            {copyFailed ? (
              <p role="status" className={styles.meta}>
                Copy this article address:{' '}
                <input
                  className={styles.copyAddress}
                  readOnly
                  aria-label="Article address"
                  value={new URL(articleURL, window.location.origin).href}
                  onFocus={(event) => event.target.select()}
                />
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Quotes become notes; links open in a new tab and only safe schemes render as links. */
const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  quote: ({ node, nodesToJSX }) => (
    <aside aria-label="Note">
      <InfoIcon className={styles.noteIcon} size={20} aria-hidden />
      <span>{nodesToJSX({ nodes: node.children })}</span>
    </aside>
  ),
  link: ({ node, nodesToJSX }) => {
    const url = node.fields.url ?? ''
    const safe = /^(https?:|mailto:|tel:|#|\/(?!\/))/i.test(url)
    return safe ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {nodesToJSX({ nodes: node.children })}
        <ExternalIcon aria-label="Opens in a new tab" />
      </a>
    ) : (
      <>{nodesToJSX({ nodes: node.children })}</>
    )
  },
})

function ArticleRows({ articles, onOpen }: { articles: HelpArticle[]; onOpen: (id: string) => void }) {
  return (
    <div className={styles.list}>
      {articles.map((item) => (
        <button key={item.id} type="button" className={styles.row} onClick={() => onOpen(item.id)}>
          <span>{item.title}</span>
          <ChevronDownIcon className={styles.rowArrow} size={14} aria-hidden />
        </button>
      ))}
    </div>
  )
}
