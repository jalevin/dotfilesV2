-- Leader must be set before lazy.nvim loads
vim.g.mapleader = ','
vim.g.maplocalleader = ','

-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- Settings (no plugin deps)
vim.cmd('source ' .. vim.fn.stdpath('config') .. '/settings.vim')

-- Load plugins
require("lazy").setup("plugins")

-- Auto-install on first launch (no plugins installed yet)
vim.api.nvim_create_autocmd("VimEnter", {
  once = true,
  callback = function()
    if require("lazy").stats().installed == 0 then
      require("lazy").sync()
    end
  end,
})

-- Colorscheme (after plugins are loaded)
pcall(vim.cmd, 'colorscheme molokai')

-- Plugin configs (pcall guards first-run before Lazy sync completes)
pcall(require, 'lsp-init')
pcall(require, 'cmp-init')
pcall(require, 'telescope-init')
pcall(require, 'nvim-tree-init')

-- Keymaps (sourced last — some reference plugin commands)
vim.cmd('source ' .. vim.fn.stdpath('config') .. '/keymaps.vim')
