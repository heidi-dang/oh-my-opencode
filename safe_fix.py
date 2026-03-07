with open("src/plugin/event.test.ts", "r") as f:
    text = f.read()

text = text.replace(
'''			event: {
				type: "message.updated",
			},''',
'''			event: {
				type: "message.updated",
			} as unknown as Event,'''
)

text = text.replace(
'''			event: {
				type: "session.idle",
				properties: {
					sessionID: "ses_stale_1",
				},
			},''',
'''			event: {
				type: "session.idle",
				properties: {
					sessionID: "ses_stale_1",
				},
			} as unknown as Event,'''
)

text = text.replace(
'''			event: {
				type: "session.deleted",
				properties: { info: { id: sessionID } },
			},''',
'''			event: {
				type: "session.deleted",
				properties: { info: { id: sessionID } },
			} as unknown as Event,'''
)

text = text.replace('hooks: {', 'hooks: ({')
text = text.replace(
'''				atlasHook: { handler: async () => {} },
			},''',
'''				atlasHook: { handler: async () => {} },
			} as unknown as Record<string, unknown>),'''
)

with open("src/plugin/event.test.ts", "w") as f:
    f.write(text)

