module.exports = {
    plugins: [
    {
        module: require('../'),
        options: {
            baseId: "appL6vJByD0dxVlnA",
            tables: {
                "poems": ['Start', 'Finish'],
                "words": ['Word']
            }
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
