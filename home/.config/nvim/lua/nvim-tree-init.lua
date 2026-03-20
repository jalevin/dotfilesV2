-- NVIMTREE - code navigation
require 'nvim-tree'.setup({
  git = {
    -- show ignored git files
    ignore = false
  },
  -- https://taoshu.in/vim/migrate-nerdtree-to-nvim-tree.html
  renderer = {
    icons = {
      show = {
        git = true,
        file = false,
        folder = false,
        folder_arrow = true,
      },
      glyphs = {
        folder = {
          arrow_closed = "⏵",
          arrow_open = "⏷",
        },
        git = {
          unstaged = "✗",
          staged = "✓",
          unmerged = "⌥",
          renamed = "➜",
          untracked = "★",
          deleted = "⊖",
          ignored = "◌",
        },
      },
    },
  },
})
