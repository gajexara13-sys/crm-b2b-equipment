import React, { createContext, useCallback, useContext, useState } from 'react'

const ConfirmContext = createContext(null)

/**
 * @param {string|object} opts — текст или { title?, message, confirmText?, cancelText?, danger? }
 * @returns {Promise<boolean>}
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)

  const confirm = useCallback((opts) => {
    const normalized =
      typeof opts === 'string'
        ? { message: opts }
        : { ...opts }
    return new Promise((resolve) => {
      setState({
        title: normalized.title ?? 'Подтвердите действие',
        message: normalized.message ?? '',
        confirmText: normalized.confirmText ?? 'ОК',
        cancelText: normalized.cancelText ?? 'Отмена',
        danger: !!normalized.danger,
        resolve,
      })
    })
  }, [])

  const finish = useCallback((value) => {
    setState((s) => {
      if (s) s.resolve(value)
      return null
    })
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => finish(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="crm-confirm-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface, #fff)',
              color: 'var(--text, #1a1a2e)',
              borderRadius: 12,
              padding: '1.35rem 1.5rem',
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18), 0 0 0 1px var(--border, #e2e8f0)',
            }}
          >
            <h3 id="crm-confirm-title" style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>
              {state.title}
            </h3>
            <p
              style={{
                margin: '0 0 1.25rem',
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--text3, #555)',
                whiteSpace: 'pre-line',
              }}
            >
              {state.message}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => finish(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #e2e8f0)',
                  background: 'var(--surface2, #f8fafc)',
                  color: 'var(--text3, #475569)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {state.cancelText}
              </button>
              <button
                type="button"
                onClick={() => finish(true)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: state.danger ? '#dc2626' : 'var(--primary, #185fa5)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const fn = useContext(ConfirmContext)
  if (!fn) return async (opts) => window.confirm(typeof opts === 'string' ? opts : opts.message)
  return fn
}
