# Plugin for Planning.Domains

### Installation

The current plugin installation URL is:

`https://gistcdn.githack.com/BernardoDenkvitts/c9a65c4872e6b11c75d28afd056974b7/raw/4701825fbe29b7a1d1e8d556563f0f551bc7c9ab/plugin.js`

---

### Plugin Demonstration

https://github.com/user-attachments/assets/4a7be723-422c-43b5-ae1b-14cbce52dec0

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

---

### Quick access with the plugin

To access the `editor.planning.domains` with the plugin already loaded, simply add your plugin's URL to the end of the editor's URL.

- **With Surge:**
  `https://editor.planning.domains/#https://{your-surge-url}/plugin.js`
- **With Gist:**
  `https://editor.planning.domains/#{your-gist-url}` 



### You can check other plugins' code at this link
https://github.com/AI-Planning?q=Plugin
