import { useConfirm } from './ConfirmDialog'

/**
 * Модальное окно с подтверждением при клике на фон.
 *
 * Props:
 *   onClose      — функция закрытия (вызывается после подтверждения)
 *   children     — содержимое окна
 *   zIndex       — z-index backdrop (default 1200)
 *   maxWidth     — максимальная ширина контента (default 980)
 *   noConfirm    — если true, закрывает без подтверждения (для простых окон просмотра)
 */
export default function Modal({ onClose, children, zIndex = 1200, maxWidth = 980, noConfirm = false }) {
  const confirm = useConfirm()

  const handleBackdrop = async (e) => {
    if (e.target !== e.currentTarget) return
    if (noConfirm) {
      onClose()
      return
    }
    const ok = await confirm({
      title: 'Закрыть без сохранения?',
      message: 'Введённые данные не сохранятся.',
      confirmText: 'Да, выйти',
      cancelText: 'Остаться',
    })
    if (ok) onClose()
  }

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex,
        overflowY: 'auto',
        padding: '1.5rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth, margin: '0 auto' }}
      >
        {children}
      </div>
    </div>
  )
}
