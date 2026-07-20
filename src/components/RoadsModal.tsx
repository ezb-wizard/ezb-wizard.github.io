import { useState } from 'react'
import { useApp } from '../store'
import type { Hand, Winner } from '../types'
import RoadsPanel, { ProbPanel } from './RoadsPanel'
import { Confirm, GhostBtn, Modal, PrimaryBtn } from './ui'

/** プレイ中に罫線と確率をすぐ確認できるモーダル(途中参加のまとめ入力つき) */
export default function RoadsModal({ hands, onClose }: { hands: Hand[]; onClose: () => void }) {
  const { session, addHandsBulk } = useApp()
  const [bulkOpen, setBulkOpen] = useState(false)
  const [seq, setSeq] = useState<Winner[]>([])
  const [confirmBulk, setConfirmBulk] = useState(false)

  if (!session) return null

  return (
    <Modal title="罫線・確率" onClose={onClose}>
      <div className="space-y-3 pb-2">
        <ProbPanel hands={hands} />
        <RoadsPanel hands={hands} sideBets={session.sideBets} />

        {!bulkOpen ? (
          <GhostBtn onClick={() => setBulkOpen(true)}>
            途中参加:これまでの出目をまとめて登録
          </GhostBtn>
        ) : (
          <div className="card-luxe space-y-2 p-3">
            <p className="text-[11px] leading-relaxed text-ink-2">
              テーブルの電光掲示(罫線)を見ながら、開始からの出目を順にタップしてください。
              ベットなしの「見」ハンドとして記録され、罫線と出現率統計に反映されます。
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['B', 'P', 'T'] as const).map((w) => (
                <button
                  key={w}
                  className={`press h-14 rounded-lg text-base font-bold text-white ${
                    w === 'B' ? 'bg-banker' : w === 'P' ? 'bg-player' : 'bg-tie'
                  }`}
                  onClick={() => setSeq((s) => [...s, w])}
                >
                  {w === 'B' ? 'バンカー' : w === 'P' ? 'プレイヤー' : 'タイ'}
                </button>
              ))}
            </div>
            <div className="flex min-h-8 flex-wrap gap-1">
              {seq.map((w, i) => (
                <span
                  key={i}
                  className={`num flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    w === 'B' ? 'bg-banker' : w === 'P' ? 'bg-player' : 'bg-tie'
                  }`}
                >
                  {w}
                </span>
              ))}
              {seq.length === 0 && <span className="text-xs text-ink-3">(未入力)</span>}
            </div>
            <div className="flex gap-2">
              <GhostBtn onClick={() => setSeq((s) => s.slice(0, -1))}>1つ戻す</GhostBtn>
              <GhostBtn
                onClick={() => {
                  setSeq([])
                  setBulkOpen(false)
                }}
              >
                キャンセル
              </GhostBtn>
              <PrimaryBtn className="h-12 flex-1" disabled={seq.length === 0} onClick={() => setConfirmBulk(true)}>
                {seq.length}ハンド登録
              </PrimaryBtn>
            </div>
          </div>
        )}
      </div>

      {confirmBulk && (
        <Confirm
          message={`${seq.length}ハンドを「見」として登録しますか?`}
          detail="ベットなし・収支0の記録として追加されます(あとから履歴で編集・削除できます)"
          okLabel="登録する"
          onOk={() => {
            void addHandsBulk(seq)
            setSeq([])
            setBulkOpen(false)
            setConfirmBulk(false)
          }}
          onCancel={() => setConfirmBulk(false)}
        />
      )}
    </Modal>
  )
}
