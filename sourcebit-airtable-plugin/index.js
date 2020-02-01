const Airtable = require('airtable');
const _ = require('lodash');
const pkg = require("./package.json");

module.exports.name = pkg.name;

module.exports.options = {
    apiKey: {
        env: "AIRTABLE_API_KEY",
        private: true
    },
    baseId: {},
    tables: [],
    watch: {
        // 👉 By default, the value of this option will be `false`.
        default: false,

        // 👉 The value for this option will be read from the `watch`
        // runtime parameter, which means that if the user starts
        // Sourcebit with `sourcebit fetch --watch`, then the value
        // of this option will be set to `true`, regardless of any
        // other value defined in the configuration file.
        runtimeParameter: "watch"
    }
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                           *
 *  📌 bootstrap (Function)                                  *
 *     =========                                             *
 *                                                           *
 *  A function to be executed once when the plugin starts.   *
 *  It receives an object with the following properties:     *
 *                                                           *
 *  - `debug` (Function): A method for printing data that    *
 *    might be useful to see when debugging the plugin.      *
 *    Data sent to this method will be hidden from the user  *
 *    unless the application is in debug mode.               *
 *  - `getPluginContext` (Function): A function for getting  *
 *    the plugin's context object.                           *
 *  - `log` (Function): A method for logging a message. It   *
 *    adds a prefix with the name of the plugin that created *
 *    it, and respects the verbosity settings specified by   *
 *    the user.                                              *
 *  - `options` (Object): The plugin options object, as they *
 *    come from the main configuration file, `.env` files    *
 *    and runtime parameters.                                *
 *  - `refresh` (Function): A function to be called whenever *
 *    there are changes in the data managed by the plugin,   *
 *    forcing the entire plugin chain to be re-executed.     *
 *  - `setPluginContext` (Function): A function for setting  *
 *    the plugin's context object                            *
 *                                                           *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
module.exports.bootstrap = async ({
    debug,
    getPluginContext,
    log,
    options,
    refresh,
    setPluginContext
}) => {
    const base = new Airtable({apiKey: options.apiKey}).base(options.baseId);

    const context = getPluginContext();

    if (context && context.entries && false) {
        log(`Loaded ${context.entries.length} entries from cache`);
    } else {
        // get data
        const entries = await options.tables.reduce((acc, table) => {
            return acc.then(entries => {

                entries[table] = [];
                return base(table).select({
                    // fields: [] // TODO: get only requested of the fields
                    view: "Grid view"
                }).eachPage((records, fetchNextPage) => {
                    records.forEach(record => {
                        entries[table].push(record.fields);
                        console.log('Retrieved', record.fields);
                    });
                
                    fetchNextPage();
                }).then(() => {
                    return entries;
                }).catch(err => {
                    console.error(err);
                });    

            })
        }, Promise.resolve({}))

        // we're done
        log(`Generated ${Object.keys(entries).length} tables`);
        debug("Initial entries: %O", entries);

        setPluginContext({
            entries
        });
    }
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                           *
 *  📌 transform (Function)                                  *
 *     =========                                             *
 *                                                           *
 *  A function to be executed once when the plugin starts    *
 *  and whenever one of the plugins triggers an update       *
 *  (i.e. by calling `refresh()` inside `bootstrap()`).      *
 *  Its purpose is to receive and transform an object that   *
 *  contains data buckets, which are arrays of entries.      *
 *  Therefore, the return value of this method must be a     *
 *  new data object.                                         *
 *  Please note that in the first execution, `transform`     *
 *  always runs after `bootstrap()`.                         *
 *  It receives an object with the following properties:     *
 *                                                           *
 *  - `data` (Object): The input data object, containing     *
 *    data buckets.                                          *
 *  - `debug` (Function): A method for printing data that    *
 *    might be useful to see when debugging the plugin.      *
 *    Data sent to this method will be hidden from the user  *
 *    unless the application is in debug mode.               *
 *  - `getPluginContext` (Function): A function for getting  *
 *    the plugin's context object.                           *
 *  - `log` (Function): An alias for `console.log` that adds *
 *    to the message information about the plugin it comes   *
 *    from.                                                  *
 *  - `options` (Object): The plugin options object, as they *
 *    come from the main configuration file, `.env` files    *
 *    and runtime parameters.                                *
 *                                                           *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
module.exports.transform = ({
  data,
  debug,
  getPluginContext,
  login,
  options
}) => {
    const { entries } = getPluginContext();

    const models = _.mapValues(entries, (elems, table) => {
        return {
          source: pkg.name,
          modelName: table,
          modelLabel: table,
          projectId: options.baseId,
          fieldNames: _.keys(elems[0])
        }
    })

    const normalizedEntries = _.reduce(entries, (result, elements, table) => {
        return _.concat(result, _.map(elements, (elem) => {
            return {
                ...elem,
                id: 1, // <TODO: where should this come from? airtable?
                __metadata: models[table]
            }
        }))
    }, [])

    return {
        ...data,
        models: data.models.concat(_.values(models)),
        objects: data.objects.concat(normalizedEntries)
    };
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                           *
 *  📌 getSetup (Function)                                   *
 *     ========                                              *
 *                                                           *
 *  A function to be executed as part of the interactive     *
 *  setup process for this plugin.                           *
 *  It receives an object with the following properties:     *
 *                                                           *
 *  - `chalk` (Function): An instance of the `chalk` npm     *
 *    module (https://www.npmjs.com/package/chalk), used in  *
 *    the command-line interface for styling text.           *
 *  - `context` (Object): The global context object, shared  *
 *    by all plugins.                                        *
 *  - `data` (Object): The data object populated by all      *
 *    previous plugins.                                      *
 *    data buckets.                                          *
 *  - `debug` (Function): A method for printing data that    *
 *    might be useful to see when debugging the plugin.      *
 *    Data sent to this method will be hidden from the user  *
 *    unless the application is in debug mode.               *
 *  - `getSetupContext` (Function): A function for getting   *
 *    the context object that is shared between all the      *
 *    plugins during the setup process.                      *
 *  - `inquirer` (Function): An instance of the `inquirer`   *
 *    npm module (https://www.npmjs.com/package/inquirer),   *
 *    used in the command-line interface to prompt questions *
 *    to the user.                                           *
 *  - `ora` (Function): An instance of the `ora` npm module  *
 *    (https://www.npmjs.com/package/ora), used in the       *
 *    command-line interface to display information and      *
 *    error messages, as well as loading states.             *
 *  - `setSetupContext` (Function): A function for setting   *
 *    the context object that is shared between all the      *
 *    plugins during the setup process.                      *
 *                                                           *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
module.exports.getSetup = ({
  chalk,
  context,
  data,
  debug,
  getSetupContext,
  inquirer,
  ora,
  setSetupContext
}) => {
  const questions = [
    {
      type: "number",
      name: "pointsForJane",
      message: "How many points should Jane start with?"
    },
    {
      type: "number",
      name: "pointsForJohn",
      message: "How many points should John start with?"
    }
  ];

  // 👉 For simple setup processes, this method can simply return
  // an array of questions in the format expected by `inquirer`.
  // Alternatively, it can run its own setup instance, display
  // messages, make external calls, etc. For this, it should return
  // a function which, when executed, must return a Promise with
  // an answers object.
  return async () => {
    const spinner = ora("Crunching some numbers...").start();

    // ⏳ await runSomeAsyncTask();

    spinner.succeed();

    const answers = await inquirer.prompt(questions);

    return answers;
  };
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                           *
 *  📌 getOptionsFromSetup (Function)                        *
 *     ===================                                   *
 *                                                           *
 *  A function to be executed after the interactive has      *
 *  finished.                                                *
 *  It receives an object with the following properties:     *
 *                                                           *
 *  - `answers` (Object): The answers generated during the   *
 *    interactive setup process.                             *
 *    data buckets.                                          *
 *  - `debug` (Function): A method for printing data that    *
 *    might be useful to see when debugging the plugin.      *
 *    Data sent to this method will be hidden from the user  *
 *    unless the application is in debug mode.               *
 *  - `getSetupContext` (Function): A function for getting   *
 *    the context object that is shared between all the      *
 *    plugins during the setup process.                      *
 *  - `setSetupContext` (Function): A function for setting   *
 *    the context object that is shared between all the      *
 *    plugins during the setup process.                      *
 *                                                           *
 *  The return value of this function must be the object     *
 *  that is to be set as the `options` block of the plugin   *
 *  configuration in `sourcebit.js`.                         *
 *                                                           *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
module.exports.getOptionsFromSetup = ({
  answers,
  debug,
  getSetupContext,
  setSetupContext
}) => {
  // 👉 This is a good place to make some transformation to the
  // values generated in the setup process before they're added
  // to the configuration file. In this case, we're just making
  // up a use case where we want to ensure that John's points
  // do not exceed 15.
  return {
    pointsForJane: answers.pointsForJane,
    pointsForJohn: Math.min(answers.pointsForJohn, 15)
  };
};
