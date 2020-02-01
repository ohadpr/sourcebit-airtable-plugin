module.exports = {
    plugins: [
    {
        module: require('./sourcebit-airtable-plugin'),
        options: {
            baseId: "appL6vJByD0dxVlnA",
            tables: ["poems", "words"]
        }
    },
    {
      module: require('sourcebit-target-jekyll'),
      options: {
        writeFile: function anonymous(entry,utils) {
            const { __metadata: meta, ...fields } = entry;
            if (!meta) return;

            return {
                append: true,
                content: fields,
                format: 'json',
                path: 'data.json'
            };
        }
      }
    }
  ]
}
