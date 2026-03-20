syntax on
filetype plugin indent on
set mouse=a
set ruler
set tabstop=2
set shiftwidth=2
set number
set expandtab
set autoindent
set copyindent
set foldmethod=syntax
set foldlevelstart=99
set termguicolors

" set text width to 80. in program files this will only wrap comments.
" in html and shell scripts, don't wrap at all
set textwidth=120
autocmd FileType html,sh set textwidth=0

"" add highlighting for note and todo
match vimTodo "FIXME"
match vimTodo "NOTE"

" speedup since I run vim from terminal
let did_install_default_menus = 1
let did_install_syntax_menu = 1

" enable gitgutter
let g:gitgutter_enabled = 1

" rainbow parenthesis
let g:rainbow_active = 1

" settings for vim-test jest
let test#javascript#jest#executable = 'yarn run jest'
let test#strategy = 'floaterm'

" keep vim-go from setting go doc mapping
let g:go_def_mapping_enabled = 0
let g:go_doc_keywordprg_enabled = 0
let g:go_metalinter_command = 'golangci-lint'

" treesitter folding (set per-buffer via autocmd)
function! FoldConfig()
  set foldmethod=expr
  set foldexpr=nvim_treesitter#foldexpr()
endfunction
autocmd BufAdd,BufEnter,BufNew,BufNewFile,BufWinEnter * :call FoldConfig()
