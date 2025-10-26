module.exports = function (conf) {
  conf.addPassthroughCopy('./src/styles.css')
  conf.addPassthroughCopy('./src/script.js')
  conf.addPassthroughCopy('./src/index.js')
  conf.addPassthroughCopy('./src/assets');
  conf.addPassthroughCopy('./src/images');
  conf.addPassthroughCopy('./src/fonts');

  return {
    dir: {
      input: './src',
      includes: './includes'
    },
    htmlTemplateEngine: 'njk'
  }
}
