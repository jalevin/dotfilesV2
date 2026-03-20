" LSP — :help vim.lsp.* for docs
noremap gD <cmd>lua vim.lsp.buf.declaration()<CR>
noremap gd <cmd>lua vim.lsp.buf.definition()<CR>
noremap K <cmd>lua vim.lsp.buf.hover()<CR>
noremap gi <cmd>lua vim.lsp.buf.implementation()<CR>
noremap gr <cmd>lua vim.lsp.buf.references()<CR>
noremap <leader>D <cmd>lua vim.lsp.buf.type_definition()<CR>
noremap <leader>R <cmd>lua vim.lsp.buf.rename()<CR>
noremap <leader>ca <cmd>lua vim.lsp.buf.code_action()<CR>
" format on save
autocmd BufWritePre <buffer> lua vim.lsp.buf.format()
" format on cmd
noremap <leader>F <cmd>lua vim.lsp.buf.format()<CR>
noremap <leader>lr <cmd>LspRestart<CR>

noremap E <cmd>lua vim.diagnostic.open_float()<CR>
noremap N <cmd>lua vim.diagnostic.goto_next()<CR>
noremap P <cmd>lua vim.diagnostic.goto_prev()<CR>
noremap <leader>L <cmd>lua vim.diagnostic.set_loclist()<CR>
noremap <Leader>li :LspInfo<CR>

noremap <Leader>x <cmd>lua vim.print(null_ls.builtins)<CR>

" codebase navigation
noremap <S-Left> :cprevious<cr>
noremap <S-Right> :cnext<cr>

" nvim tree
noremap <leader>nt <cmd>:NvimTreeToggle<CR>

" telescope
noremap <leader>ff <cmd>lua require('telescope.builtin').find_files()<CR>
noremap <leader>fg <cmd>lua require('telescope.builtin').live_grep()<CR>
noremap <leader>fw <cmd>lua require('telescope.builtin').live_grep()<CR>
noremap <leader>fb <cmd>lua require('telescope.builtin').buffers()<CR>
noremap <leader>fbg <cmd>lua require('telescope.builtin').live_grep({grep_open_files=true})<CR>
noremap <leader>fs <cmd>lua require('telescope.builtin').lsp_document_symbols()<CR>

" vim-test
noremap <leader>tn :TestNearest<CR>
noremap <leader>tf :TestFile<CR>
noremap <leader>ts :TestSuite<CR>
noremap <leader>tnd> :TestNearest<CR>
function! DebugNearest()
  let g:test#go#runner = 'delve'
  TestNearest
  unlet g:test#go#runner
endfunction
nmap <silent> t<C-d> :call DebugNearest()<CR>

" convenience mappings
noremap <leader>nb :new<CR>
" edit/reload nvim config
noremap <leader>ev :e $MYVIMRC<CR>
noremap <leader>el :e ~/.config/nvim/lua<CR>
noremap <Leader>rl :so $MYVIMRC<CR>

" clipboard
vnoremap <leader>y "+y
nnoremap <leader>yy "+yy
noremap <leader>Y "+yg_
cnoreabbrev move Move
cnoreabbrev delete Delete

" double tap esc to:
"   dehighlight the last search
"   close quickfix window
"   close Floatterm
noremap <Esc><Esc> :noh<bar>:cclose<bar>:FloatermKill<CR>

" esc to exit terminal mode
tnoremap <Esc> <C-\><C-n><CR>

" format with jq
command! JQ set ft=json | :%!jq .

" maintain selection fixing indent
vnoremap > >gv
vnoremap < <gv
vnoremap = =gv

" show capture group word is highlighted by
noremap <F10> :echo "hi<" . synIDattr(synID(line("."),col("."),1),"name") . '> trans<'
      \ . synIDattr(synID(line("."),col("."),0),"name") . "> lo<"
      \ . synIDattr(synIDtrans(synID(line("."),col("."),1)),"name") . ">"<CR>
