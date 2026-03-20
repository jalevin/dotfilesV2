local telescope = require("telescope")
--local telescopeConfig = require("telescope.config")
local actions = require("telescope.actions")
-- Clone the default Telescope configuration
telescope.setup({
  defaults = {
    -- `hidden = true` is not supported in text grep commands.
    vimgrep_arguments = {
      "rg",
      "--color=never",
      "--no-heading",
      "--with-filename",
      "--line-number",
      "--column",
      "--smart-case",
      "--hidden",
      "--unrestricted",
    },
    mappings = {
      i = {
        ["<esc>"] = actions.close,
      },
    },
  },
  pickers = {
    find_files = {
      -- `hidden = true` will still show the inside of `.git/` as it's not `.gitignore`d.
      find_command = {
        "rg",
        "--files",
        "--hidden",
        "--glob",
        "!**/.{git,.node_modules,.bingo,.changelog-archive,.betterer-results}/*",
        "--unrestricted",
      },
    },
  },
})
