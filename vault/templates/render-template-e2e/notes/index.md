```template-script
export async function buildContext(api) {
	return {
		generatedSuffix: api.path.shortId()
	};
}
```

## <%= it.data.title %> Notes

Tags:
<% for (const tag of it.data.tags) { %>
- <%= tag %>
<% } %>

Source body preview:
<%= it.source?.body.split("\n")[0] ?? "none" %>

Generated suffix: <%= it.script.generatedSuffix %>
