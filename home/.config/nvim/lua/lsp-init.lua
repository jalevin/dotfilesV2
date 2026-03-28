-- AUTOCOMPLETE get default capabilities for autocomplete
local capabilities = require("cmp_nvim_lsp").default_capabilities(vim.lsp.protocol.make_client_capabilities())

-- Global LSP defaults (applies to all servers)
vim.lsp.config('*', {
	capabilities = capabilities,
	on_attach = on_attach,
})

-- lua_ls: suppress unknown global warnings for vim/on_attach
vim.lsp.config('lua_ls', {
	settings = {
		Lua = {
			diagnostics = { globals = { "vim", "on_attach" } },
		},
	},
})

-- MASON package manager
require("mason").setup({
	ui = {
		icons = {
			package_installed = "✓",
			package_pending = "➜",
			package_uninstalled = "✗",
		},
	},
})

require("mason-lspconfig").setup({
	ensure_installed = {
		"bashls",
		"dockerls",
		"eslint",
		"golangci_lint_ls",
		"gopls",
		"html",
		"jsonls",
		"jsonnet_ls",
		"lua_ls",
		"marksman",
		"sqlls",
		"tailwindcss",
		"terraformls",
		"ts_ls",
		"vimls",
	},
	handlers = {
		function(server_name)
			vim.lsp.enable(server_name)
		end,
	},
})

-- LINTER/FORMATTING configure mason for linters
require("mason-null-ls").setup({
	ensure_installed = {
		"ansible-lint",
		--"goimports_reviser",
		"markdownlint",
		"misspell",
		"staticcheck",
		"yamllint",
		"stylua",
		"jq",
		"prettier",
		--"action-lint",
	},
	handlers = {},
})

-- ruby_lsp: installed via install script, not Mason (C extension ABI issues)
vim.lsp.config('ruby_lsp', {
	init_options = {
		formatter = 'standard',
		linters = { 'standard' },
	},
})
vim.lsp.enable('ruby_lsp')

local async_formatting = function(bufnr)
	bufnr = bufnr or vim.api.nvim_get_current_buf()

	vim.lsp.buf_request(
		bufnr,
		"textDocument/formatting",
		vim.lsp.util.make_formatting_params({}),
		function(err, res, ctx)
			if err then
				local err_msg = type(err) == "string" and err or err.message
				-- you can modify the log message / level (or ignore it completely)
				vim.notify("formatting: " .. err_msg, vim.log.levels.WARN)
				return
			end

			-- don't apply results if buffer is unloaded or has been modified
			if not vim.api.nvim_buf_is_loaded(bufnr) or vim.api.nvim_buf_get_option(bufnr, "modified") then
				return
			end

			if res then
				local client = vim.lsp.get_client_by_id(ctx.client_id)
				vim.lsp.util.apply_text_edits(res, bufnr, client and client.offset_encoding or "utf-16")
				vim.api.nvim_buf_call(bufnr, function()
					vim.cmd("silent noautocmd update")
				end)
			end
		end
	)
end

local augroup = vim.api.nvim_create_augroup("LspFormatting", {})
require("null-ls").setup({
	on_attach = function(client, bufnr)
		if client.supports_method("textDocument/formatting") then
			vim.api.nvim_clear_autocmds({ group = augroup, buffer = bufnr })
			vim.api.nvim_create_autocmd("BufWritePost", {
				group = augroup,
				buffer = bufnr,
				callback = function()
					async_formatting(bufnr)
				end,
			})
		end
	end,
})
