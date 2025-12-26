# Plugin for Planning.Domains

### Installation

The current plugin installation URL is:

`https://rawcdn.githack.com/ai4society/planning-ontology-tool/73a25ec8ed4ab4b14b789f2929d799a7bd55c168/plugin.js`

---

### Plugin Demonstration



https://github.com/user-attachments/assets/d4934687-490c-4765-b8c8-a4f75fd4014b



---

### How to test your changes

There are different ways to host and test the plugin. Below are two tested options: **Surge** and **Gist**.

#### 1. Using Surge

1. Install Surge:

        npm install -g surge

2. Create a folder and copy or place the `plugin.js` file inside it.
3. Run Surge in the folder to publish the plugin:

        surge {folder-name}

4. (Optional) To shutdown Surge server:

        surge teardown {your-surge-url}

**Important:** When Surge asks for the domain, type the same URL you used previously (if you already have one), otherwise a new URL will be created.
Reusing the same domain keeps your plugin URL stable even after updates.

#### 2. Using Gist

1. Access [https://gist.github.com/](https://gist.github.com/).
2. In the "Filename including extension" field, type `plugin.js`.
3. Paste your `plugin.js` code into the Gist editor.
4. Click the **"Raw"** button to get the file URL.
5. **Copy the URL** and replace the first part (`https://gist.githubusercontent.com/`) with `https://gistcdn.githack.com/` to ensure the plugin installs correctly.

**Important:** Every time you update the code in your Gist, the "Raw" URL changes. Make sure to always copy the new URL after each update.

<!-- ---

### Quick access with the plugin

To access the `editor.planning.domains` with the plugin already loaded, simply add your plugin's URL to the end of the editor's URL.

- **With Surge:**
  `https://editor.planning.domains/#https://{your-surge-url}/plugin.js`
- **With Gist:**
  `https://editor.planning.domains/#{your-gist-url}`



### You can check other plugins' code at this link
https://github.com/AI-Planning?q=Plugin -->

---

## Citation

If you use this plugin in your research, please cite the following paper:

```bibtex
@article{muppasani2025building,
  title={Building a planning ontology to represent and exploit planning knowledge and its aplications},
  author={Muppasani, Bharath Chandra and Gupta, Nitin and Pallagani, Vishal and Srivastava, Biplav and Mutharaju, Raghava and Huhns, Michael N and Narayanan, Vignesh},
  journal={Discover Data},
  volume={3},
  number={1},
  pages={55},
  year={2025},
  publisher={Springer}
}
```
