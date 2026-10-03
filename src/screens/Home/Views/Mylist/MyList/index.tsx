import { useRef, useState } from 'react'
import { View } from 'react-native'
import PlaylistEditor from '@/components/PlaylistEditor'
import ListMenu, { type ListMenuType } from './ListMenu'
import List from './List'
import ListImportExport, { type ListImportExportType } from './ListImportExport'
import { handleRemove, handleSync } from './listAction'
import ListMusicSort, { type ListMusicSortType } from './ListMusicSort'
import DuplicateMusic, { type DuplicateMusicType } from './DuplicateMusic'

export default () => {
  const [editor, setEditor] = useState(false)
  const [editingList, setEditingList] = useState<LX.List.UserListInfo>()
  const [position, setPosition] = useState(-1)
  const listMenuRef = useRef<ListMenuType>(null)
  const sortRef = useRef<ListMusicSortType>(null)
  const duplicateRef = useRef<DuplicateMusicType>(null)
  const importExportRef = useRef<ListImportExportType>(null)
  const create = (index = -1) => { setEditingList(undefined); setPosition(index); setEditor(true) }
  return <View style={{ flex: 1 }}>
    <List onCreate={() => { create() }} onShowMenu={(info, position) => listMenuRef.current?.show(info, position)} />
    <PlaylistEditor visible={editor} list={editingList} position={position} onClose={() => { setEditor(false) }} />
    <ListMusicSort ref={sortRef} />
    <DuplicateMusic ref={duplicateRef} />
    <ListImportExport ref={importExportRef} />
    <ListMenu ref={listMenuRef}
      onNew={create}
      onRename={info => { setEditingList(info); setEditor(true) }}
      onSort={info => sortRef.current?.show(info)}
      onDuplicateMusic={info => duplicateRef.current?.show(info)}
      onImport={(info, index) => importExportRef.current?.import(info, index)}
      onExport={(info, index) => importExportRef.current?.export(info, index)}
      onRemove={handleRemove} onSync={info => { handleSync(info) }}
      onSelectLocalFile={(info, index) => importExportRef.current?.selectFile(info, index)}
    />
  </View>
}
