# How to Run SHOPORA

This guide is written for everyone, including people without a programming or computer-science background.

SHOPORA is a frontend shopping demo. It does not require installation of project packages, a database, or an online account.

## Method 1: Run with PowerShell and Python

This is the recommended method.

### Step 1: Open the SHOPORA folder

Open File Explorer and go to:

```text
I:\JS TAG\js-tag\Shopora
```

If your SHOPORA folder is saved somewhere else, open that location instead.

### Step 2: Open a terminal in the folder

1. Click the File Explorer address bar.
2. Type `powershell`.
3. Press **Enter**.

A blue or black terminal window will open in the SHOPORA folder.

### Step 3: Check whether Python is installed

Copy this command, paste it into PowerShell, and press **Enter**:

```powershell
python --version
```

If it displays something similar to `Python 3.11.9`, Python is installed.

If `python` is not recognized, try:

```powershell
py --version
```

### Step 4: Start the website

Use one of these commands.

If `python --version` worked:

```powershell
python -m http.server 8000
```

If only `py --version` worked:

```powershell
py -m http.server 8000
```

Keep the terminal window open while using the website.

### Step 5: Open SHOPORA in your browser

Open Chrome, Edge, or Firefox and visit:

[http://localhost:8000](http://localhost:8000)

The SHOPORA homepage should appear.

### Step 6: Stop the website

Return to the PowerShell window and press:

```text
Ctrl + C
```

You can now close the terminal.

---

## Copy-Paste PowerShell Commands

If the terminal is not already inside the SHOPORA folder, run:

```powershell
cd "I:\JS TAG\js-tag\Shopora"
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

The quotation marks are required because the folder path contains spaces.

---

## Method 2: Run with Visual Studio Code and Live Server

Use this method if you prefer clicking buttons instead of terminal commands.

### Step 1: Install Visual Studio Code

Download and install Visual Studio Code from its official website if it is not already installed.

### Step 2: Open the project

1. Open Visual Studio Code.
2. Select **File > Open Folder**.
3. Select the `Shopora` folder.
4. Click **Select Folder**.

### Step 3: Install Live Server

1. Click the **Extensions** icon on the left side.
2. Search for `Live Server`.
3. Install the extension named **Live Server** by Ritwick Dey.

You only need to install it once.

### Step 4: Start SHOPORA

1. Open `index.html` inside Visual Studio Code.
2. Right-click anywhere inside the file.
3. Select **Open with Live Server**.

The website will open automatically. The address may look like:

```text
http://127.0.0.1:5500/index.html
```

### Step 5: Stop Live Server

Click **Port: 5500** or **Go Live** in the bottom-right corner of Visual Studio Code.

---

## How to Use SHOPORA

After opening the website, you can:

1. Search for products using the header search box.
2. Browse electronics, fashion, home products, and books.
3. Filter and sort products on the Categories page.
4. Select **Quick view** to inspect a product.
5. Select the heart icon to save a product.
6. Select **Add to cart**.
7. Open the cart and change quantities.
8. Continue to checkout and place a demo order.

No real payment is processed. The checkout is only a frontend demonstration.

The cart and wishlist are saved in your browser using local storage. They remain available after refreshing the page.

---

## Adding or Changing Product Photos

1. Copy your image into:

```text
assets/products
```

2. Open:

```text
data/products.js
```

3. Find the product and add an `image` property:

```js
{
  id: 'el-1',
  name: 'ApexView TV',
  image: './assets/products/apex-tv.jpg',
  // other product information
}
```

Recommended image settings:

- JPG, PNG, or WebP format
- Square shape
- At least 800 × 800 pixels
- White or light background
- Lowercase filename without spaces, for example `apex-tv.jpg`

See [assets/products/HOW-TO-ADD-PHOTOS.txt](assets/products/HOW-TO-ADD-PHOTOS.txt) for a shorter photo guide.

---

## Common Problems

### The page is blank or products do not appear

Do not open `index.html` by double-clicking it. Start the local server and use:

[http://localhost:8000](http://localhost:8000)

### PowerShell says Python is not recognized

Try:

```powershell
py -m http.server 8000
```

If both `python` and `py` fail, install Python and enable the option named **Add Python to PATH** during installation. Alternatively, use the Visual Studio Code Live Server method.

### Port 8000 is already in use

Use another port:

```powershell
python -m http.server 8080
```

Then open:

[http://localhost:8080](http://localhost:8080)

### The terminal shows the wrong folder

Run:

```powershell
cd "I:\JS TAG\js-tag\Shopora"
```

Then start the server again.

### A new photo does not appear

1. Confirm the filename and image path match exactly.
2. Confirm the image is inside `assets/products`.
3. Save `data/products.js`.
4. Refresh the browser using `Ctrl + F5`.

### Cart information needs to be cleared

Open the browser developer tools with `F12`, open **Application** or **Storage**, and clear the local storage for `localhost`.

A simpler option is to use a private/incognito browser window.

---

## Project Files

| File or folder       | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `index.html`       | Homepage                                            |
| `category.html`    | Product catalog and filters                         |
| `cart.html`        | Shopping cart                                       |
| `checkout.html`    | Demo checkout                                       |
| `app.js`           | Search, cart, wishlist, filters, and checkout logic |
| `styles.css`       | Website design and responsive layout                |
| `data/products.js` | Product information                                 |
| `assets/products`  | Your product photos                                 |

## Important Note

SHOPORA currently runs locally as a frontend demo. Making it publicly accessible with real accounts, inventory, orders, and payments requires hosting and backend services.
