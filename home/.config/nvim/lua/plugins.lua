return {
  -- THEMES
  { 'ueaner/molokai' },
  { 'tanvirtin/monokai.nvim' },

  -- LSP
  { 'williamboman/mason.nvim' },
  { 'williamboman/mason-lspconfig.nvim' },
  { 'neovim/nvim-lspconfig' },

  -- FORMATTING
  { 'nvimtools/none-ls.nvim' },
  { 'jay-babu/mason-null-ls.nvim' },

  -- COMPLETION
  { 'hrsh7th/cmp-nvim-lsp' },
  { 'hrsh7th/nvim-cmp' },
  { 'hrsh7th/vim-vsnip' },

  -- NAVIGATION
  { 'jlanzarotta/bufexplorer' },
  { 'preservim/nerdcommenter' },
  { 'airblade/vim-gitgutter' },
  { 'kyazdani42/nvim-tree.lua' },

  -- JUMPING
  { 'nvim-lua/plenary.nvim' },
  { 'nvim-telescope/telescope.nvim' },
  { 'nvim-telescope/telescope-fzf-native.nvim', build = 'make' },

  { 'tpope/vim-surround' },
  { 'tpope/vim-eunuch' },
  { 'tpope/vim-endwise' },

  -- SYNTAX
  { 'mechatroner/rainbow_csv' },
  { 'luochen1990/rainbow' },

  -- TREESITTER
  {
    'nvim-treesitter/nvim-treesitter',
    branch = 'master',
    build = ':TSUpdate',
    config = function()
      require("nvim-treesitter.configs").setup({
        ensure_installed = {
          "comment",
          "html",
          "go",
          "graphql",
          "javascript",
          "json",
          "python",
          "ruby",
          "tsx",
          "typescript",
          "jsonnet",
        },
        highlight = {
          enable = true,
          additional_vim_regex_highlighting = false,
        },
      })
    end,
  },
  { 'nvim-treesitter/nvim-treesitter-context' },

  -- LANGUAGE
  { 'fatih/vim-go', build = ':GoUpdateBinaries' },
  { 'vim-ruby/vim-ruby' },
  { 'tpope/vim-rails' },

  -- TESTING
  { 'vim-test/vim-test' },
  { 'voldikss/vim-floaterm' },
}
