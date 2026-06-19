/**
 * OmniCalc - Premium Calculator Application Script
 * Core features: Multi-mode switching, custom Shunting-yard expression parser,
 * unit converter, age calculator, theme manager, and persistent history.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // STATE VARIABLES & DOM ELEMENTS
  // ==========================================================================
  let expression = '0';
  let isCalculated = false;
  let angleMode = 'DEG'; // 'DEG' or 'RAD'
  let history = [];

  // DOM Elements
  const body = document.body;
  const expressionLine = document.getElementById('expression-line');
  const inputLine = document.getElementById('input-line');
  const angleModeIndicator = document.getElementById('angle-mode-indicator');
  const angleToggleBtn = document.getElementById('angle-toggle');

  // Mode selectors
  const modeBtns = document.querySelectorAll('.mode-btn');
  const panels = document.querySelectorAll('.mode-panel');

  // Theme selectors
  const themeMenuBtn = document.getElementById('theme-menu-btn');
  const themeDropdown = document.getElementById('theme-dropdown');
  const themeOpts = document.querySelectorAll('.theme-opt');

  // History Drawer Elements
  const historyToggle = document.getElementById('history-toggle');
  const historyDrawer = document.getElementById('history-drawer');
  const historyClose = document.getElementById('history-close');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  // Converter elements
  const converterCatSelect = document.getElementById('converter-cat-select');
  const convertSrcVal = document.getElementById('convert-src-val');
  const convertDestVal = document.getElementById('convert-dest-val');
  const convertSrcUnit = document.getElementById('convert-src-unit');
  const convertDestUnit = document.getElementById('convert-dest-unit');



  // Age elements
  const ageDob = document.getElementById('age-dob');
  const ageTarget = document.getElementById('age-target');
  const btnCalcAge = document.getElementById('btn-calc-age');
  const ageResults = document.getElementById('age-results');
  const ageMainResult = document.getElementById('age-main-result');
  const ageNextBirthday = document.getElementById('age-next-birthday');
  const ageTotalMonths = document.getElementById('age-total-months');
  const ageTotalWeeks = document.getElementById('age-total-weeks');
  const ageTotalDays = document.getElementById('age-total-days');
  const ageTotalHours = document.getElementById('age-total-hours');

  // ==========================================================================
  // THEME MANAGEMENT
  // ==========================================================================
  themeMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle('active');
  });

  document.addEventListener('click', () => {
    themeDropdown.classList.remove('active');
  });

  themeOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      const selectedTheme = opt.dataset.theme;
      
      // Update active menu state
      themeOpts.forEach(btn => btn.classList.remove('active'));
      opt.classList.add('active');

      // Update body class
      body.className = `theme-${selectedTheme}`;
      
      // Save theme to localStorage
      localStorage.setItem('omni_theme', selectedTheme);
    });
  });

  // Load saved theme
  const savedTheme = localStorage.getItem('omni_theme') || 'glass';
  body.className = `theme-${savedTheme}`;
  themeOpts.forEach(opt => {
    if (opt.dataset.theme === savedTheme) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });

  // ==========================================================================
  // MODE TABS CONTROLLERS
  // ==========================================================================
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      
      // Change active button
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Change active panel
      panels.forEach(panel => panel.classList.remove('active'));
      document.getElementById(`panel-${mode}`).classList.add('active');

      // Sync screen indicator or display size if needed
      if (mode === 'scientific') {
        angleModeIndicator.classList.add('active');
      } else {
        angleModeIndicator.classList.remove('active');
      }
    });
  });

  // ==========================================================================
  // HISTORY SYSTEM
  // ==========================================================================
  // Toggle Drawer
  historyToggle.addEventListener('click', () => {
    historyDrawer.classList.toggle('active');
  });

  historyClose.addEventListener('click', () => {
    historyDrawer.classList.remove('active');
  });

  // Load History
  function loadHistory() {
    const savedHist = localStorage.getItem('omni_history');
    if (savedHist) {
      history = JSON.parse(savedHist);
    }
    renderHistory();
  }

  // Save calculation to history
  function saveToHistory(exprStr, resultStr) {
    history.unshift({ expr: exprStr, res: resultStr });
    if (history.length > 50) history.pop();
    localStorage.setItem('omni_history', JSON.stringify(history));
    renderHistory();
  }

  // Render History elements in Drawer
  function renderHistory() {
    historyList.innerHTML = '';
    if (history.length === 0) {
      historyList.innerHTML = '<div class="no-history">No history yet</div>';
      return;
    }

    history.forEach((item, index) => {
      const histItem = document.createElement('div');
      histItem.className = 'history-item';
      histItem.innerHTML = `
        <div class="hist-expr">${item.expr}</div>
        <div class="hist-res">${item.res}</div>
      `;
      histItem.addEventListener('click', () => {
        // Recall calculation
        expression = item.res;
        isCalculated = false;
        expressionLine.textContent = `${item.expr} =`;
        updateDisplay();
        historyDrawer.classList.remove('active');
      });
      historyList.appendChild(histItem);
    });
  }

  // Clear History
  clearHistoryBtn.addEventListener('click', () => {
    history = [];
    localStorage.removeItem('omni_history');
    renderHistory();
  });

  // Init History
  loadHistory();

  // ==========================================================================
  // MATH EXPRESSION PARSING ENGINE
  // ==========================================================================

  // Tokenizer
  function tokenize(exprStr) {
    const tokens = [];
    let i = 0;
    
    // Cleanup string
    let sanitized = exprStr
      .replace(/&times;/g, '*')
      .replace(/&divide;/g, '/')
      .replace(/&minus;/g, '-')
      .replace(/[\u00d7]/g, '*')
      .replace(/[\u00f7]/g, '/')
      .replace(/[\u2212]/g, '-')
      .replace(/π/g, 'pi');

    while (i < sanitized.length) {
      let char = sanitized[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // Check numbers
      if (/\d/.test(char) || (char === '.' && /\d/.test(sanitized[i+1]))) {
        let numStr = "";
        while (i < sanitized.length && (/\d/.test(sanitized[i]) || sanitized[i] === '.' || (sanitized[i].toLowerCase() === 'e' && (sanitized[i+1] === '+' || sanitized[i+1] === '-' || /\d/.test(sanitized[i+1]))))) {
          numStr += sanitized[i];
          if (sanitized[i].toLowerCase() === 'e' && (sanitized[i+1] === '+' || sanitized[i+1] === '-')) {
            numStr += sanitized[i+1];
            i++;
          }
          i++;
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
        continue;
      }

      // Check alphabetic (functions or constants)
      if (/[a-zA-Z]/.test(char)) {
        let word = "";
        while (i < sanitized.length && /[a-zA-Z0-9]/.test(sanitized[i])) {
          word += sanitized[i];
          i++;
        }
        word = word.toLowerCase();

        if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'sqrt', 'fact', 'exp'].includes(word)) {
          tokens.push({ type: 'FUNCTION', value: word });
        } else if (word === 'pi') {
          tokens.push({ type: 'NUMBER', value: Math.PI });
        } else if (word === 'e') {
          tokens.push({ type: 'NUMBER', value: Math.E });
        } else {
          throw new Error(`Unknown: ${word}`);
        }
        continue;
      }

      // Parentheses
      if (char === '(' || char === ')') {
        tokens.push({ type: char === '(' ? 'LPAREN' : 'RPAREN', value: char });
        i++;
        continue;
      }

      // Operators
      if (['+', '-', '*', '/', '^', '%', '!'].includes(char)) {
        tokens.push({ type: 'OPERATOR', value: char });
        i++;
        continue;
      }

      throw new Error(`Invalid symbol: ${char}`);
    }
    return tokens;
  }

  // Pre-parser to insert implicit multiplications, e.g. 2(3+4) -> 2*(3+4), 3pi -> 3*pi
  function insertImplicitMultiplications(tokens) {
    const result = [];
    for (let i = 0; i < tokens.length; i++) {
      const curr = tokens[i];
      result.push(curr);
      if (i < tokens.length - 1) {
        const next = tokens[i + 1];
        
        // Multiplier conditions
        const isCurrMultiplier = curr.type === 'NUMBER' || curr.type === 'RPAREN';
        // Multiplied conditions
        const isNextMultiplied = next.type === 'LPAREN' || next.type === 'FUNCTION' || (next.type === 'NUMBER' && curr.type === 'NUMBER'); // Number-number implies pi/e
        
        // Don't insert multiplication if standard operators are present
        if (isCurrMultiplier && isNextMultiplied) {
          result.push({ type: 'OPERATOR', value: '*' });
        }
      }
    }
    return result;
  }

  // Unary operators detection
  function tagUnaryOperators(tokens) {
    const result = [];
    for (let i = 0; i < tokens.length; i++) {
      const curr = tokens[i];
      if (curr.type === 'OPERATOR' && (curr.value === '-' || curr.value === '+')) {
        const prev = i > 0 ? tokens[i - 1] : null;
        const isUnary = !prev || prev.type === 'OPERATOR' || prev.type === 'LPAREN' || prev.type === 'FUNCTION';
        if (isUnary) {
          result.push({ type: 'UNARY_OPERATOR', value: curr.value === '-' ? 'u-' : 'u+' });
          continue;
        }
      }
      result.push(curr);
    }
    return result;
  }

  // Shunting-Yard Algorithm
  function shuntingYard(tokens) {
    const outputQueue = [];
    const operatorStack = [];

    const precedence = {
      '+': 2, '-': 2,
      '*': 3, '/': 3, '%': 3,
      '^': 4,
      'u-': 5, 'u+': 5,
      '!': 6
    };

    const associativity = {
      '+': 'LEFT', '-': 'LEFT',
      '*': 'LEFT', '/': 'LEFT', '%': 'LEFT',
      '^': 'RIGHT',
      'u-': 'RIGHT', 'u+': 'RIGHT',
      '!': 'LEFT'
    };

    for (const token of tokens) {
      if (token.type === 'NUMBER') {
        outputQueue.push(token);
      } else if (token.type === 'FUNCTION') {
        operatorStack.push(token);
      } else if (token.type === 'OPERATOR' && token.value === '!') {
        // Postfix factorial
        while (operatorStack.length > 0) {
          const top = operatorStack[operatorStack.length - 1];
          if (top.type === 'OPERATOR' || top.type === 'UNARY_OPERATOR') {
            if (precedence[top.value] > precedence['!']) {
              outputQueue.push(operatorStack.pop());
            } else {
              break;
            }
          } else {
            break;
          }
        }
        outputQueue.push(token);
      } else if (token.type === 'OPERATOR' || token.type === 'UNARY_OPERATOR') {
        const o1 = token.value;
        while (operatorStack.length > 0) {
          const top = operatorStack[operatorStack.length - 1];
          if (top.type === 'OPERATOR' || top.type === 'UNARY_OPERATOR') {
            const o2 = top.value;
            const p1 = precedence[o1];
            const p2 = precedence[o2];
            
            if ((associativity[o1] === 'LEFT' && p1 <= p2) || (associativity[o1] === 'RIGHT' && p1 < p2)) {
              outputQueue.push(operatorStack.pop());
            } else {
              break;
            }
          } else if (top.type === 'FUNCTION') {
            outputQueue.push(operatorStack.pop());
          } else {
            break;
          }
        }
        operatorStack.push(token);
      } else if (token.type === 'LPAREN') {
        operatorStack.push(token);
      } else if (token.type === 'RPAREN') {
        let lparenFound = false;
        while (operatorStack.length > 0) {
          const top = operatorStack[operatorStack.length - 1];
          if (top.type === 'LPAREN') {
            lparenFound = true;
            operatorStack.pop();
            break;
          } else {
            outputQueue.push(operatorStack.pop());
          }
        }
        if (!lparenFound) {
          throw new Error("Missing open parenthesis");
        }
        // Function evaluation hook
        if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type === 'FUNCTION') {
          outputQueue.push(operatorStack.pop());
        }
      }
    }

    while (operatorStack.length > 0) {
      const top = operatorStack[operatorStack.length - 1];
      if (top.type === 'LPAREN' || top.type === 'RPAREN') {
        throw new Error("Mismatched parenthesis");
      }
      outputQueue.push(operatorStack.pop());
    }

    return outputQueue;
  }

  // Factorial utility
  function factorial(n) {
    if (n < 0) throw new Error("Math Error");
    if (n === 0 || n === 1) return 1;
    if (!Number.isInteger(n)) throw new Error("Integer factorial only");
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  // Evaluate Reverse Polish Notation (RPN)
  function rpnEvaluate(rpn) {
    const stack = [];
    
    for (const token of rpn) {
      if (token.type === 'NUMBER') {
        stack.push(token.value);
      } else if (token.type === 'UNARY_OPERATOR') {
        if (stack.length < 1) throw new Error("Syntax Error");
        const val = stack.pop();
        stack.push(token.value === 'u-' ? -val : val);
      } else if (token.type === 'OPERATOR') {
        if (token.value === '!') {
          if (stack.length < 1) throw new Error("Syntax Error");
          stack.push(factorial(stack.pop()));
          continue;
        }

        if (stack.length < 2) throw new Error("Syntax Error");
        const b = stack.pop();
        const a = stack.pop();

        switch (token.value) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/': 
            if (b === 0) throw new Error("Divide by Zero");
            stack.push(a / b); 
            break;
          case '%': stack.push(a % b); break;
          case '^': stack.push(Math.pow(a, b)); break;
        }
      } else if (token.type === 'FUNCTION') {
        if (stack.length < 1) throw new Error("Syntax Error");
        const val = stack.pop();
        const radFactor = angleMode === 'DEG' ? (Math.PI / 180) : 1;
        const degFactor = angleMode === 'DEG' ? (180 / Math.PI) : 1;

        switch (token.value) {
          case 'sin': stack.push(Math.sin(val * radFactor)); break;
          case 'cos': stack.push(Math.cos(val * radFactor)); break;
          case 'tan': stack.push(Math.tan(val * radFactor)); break;
          case 'asin': 
            if (val < -1 || val > 1) throw new Error("Math Error");
            stack.push(Math.asin(val) * degFactor); 
            break;
          case 'acos': 
            if (val < -1 || val > 1) throw new Error("Math Error");
            stack.push(Math.acos(val) * degFactor); 
            break;
          case 'atan': stack.push(Math.atan(val) * degFactor); break;
          case 'ln': 
            if (val <= 0) throw new Error("Math Error");
            stack.push(Math.log(val)); 
            break;
          case 'log': 
            if (val <= 0) throw new Error("Math Error");
            stack.push(Math.log10(val)); 
            break;
          case 'sqrt': 
            if (val < 0) throw new Error("Math Error");
            stack.push(Math.sqrt(val)); 
            break;
          case 'exp': stack.push(Math.exp(val)); break;
        }
      }
    }

    if (stack.length !== 1) throw new Error("Syntax Error");
    return stack[0];
  }

  // Master expression runner
  function calculateExpression(exprStr) {
    try {
      const tokens = tokenize(exprStr);
      const parsedTokens = insertImplicitMultiplications(tokens);
      const unaryTagged = tagUnaryOperators(parsedTokens);
      const rpn = shuntingYard(unaryTagged);
      const result = rpnEvaluate(rpn);
      
      // Floating point correction (e.g. 0.1 + 0.2 = 0.30000000000000004)
      if (Math.abs(result) < 1e-12 && Math.abs(result) > 0) {
        return "0";
      }
      
      // Format response beautifully
      const strVal = result.toString();
      if (strVal.includes('.') && strVal.length > 15) {
        const fixedVal = parseFloat(result.toFixed(10));
        return fixedVal.toString();
      }
      return strVal;
    } catch (err) {
      return err.message;
    }
  }

  // ==========================================================================
  // DISPLAY & INTERACTION SYSTEM
  // ==========================================================================
  function updateDisplay() {
    // Standardise mathematical views
    let displayHtml = expression
      .replace(/\*/g, ' &times; ')
      .replace(/\//g, ' &divide; ')
      .replace(/-/g, ' &minus; ')
      .replace(/\+/g, ' + ')
      .replace(/pi/g, '&pi;')
      .replace(/\^/g, '^')
      .replace(/fact\(/g, 'fact(');
    
    inputLine.innerHTML = displayHtml === "" ? "0" : displayHtml;
    
    // Auto-scale input line text size based on length to prevent layout leaks
    const charCount = inputLine.textContent.length;
    if (charCount > 18) {
      inputLine.style.fontSize = '1.4rem';
    } else if (charCount > 12) {
      inputLine.style.fontSize = '1.9rem';
    } else {
      inputLine.style.fontSize = '2.5rem';
    }
    
    // Auto scroll display right
    inputLine.scrollLeft = inputLine.scrollWidth;
  }

  function clearAll() {
    expression = '0';
    expressionLine.textContent = '';
    isCalculated = false;
    updateDisplay();
  }

  function handleInput(val) {
    if (isCalculated) {
      // If we start typing after =, replace output (or append operator)
      if (['+', '-', '*', '/', '^', '%'].includes(val)) {
        expression = expression + val;
      } else {
        expression = val;
      }
      isCalculated = false;
      expressionLine.textContent = '';
    } else {
      if (expression === '0' && val !== '.') {
        // Prevent leading zeros issues
        if (['+', '*', '/', '^', '%'].includes(val)) {
          expression = '0' + val;
        } else {
          expression = val;
        }
      } else {
        expression += val;
      }
    }
    updateDisplay();
  }

  function handleBackspace() {
    if (isCalculated) {
      clearAll();
      return;
    }

    const functionsList = ['asin(', 'acos(', 'atan(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt(', 'fact(', 'exp('];
    for (const fn of functionsList) {
      if (expression.endsWith(fn)) {
        expression = expression.slice(0, -fn.length);
        if (expression === "") expression = '0';
        updateDisplay();
        return;
      }
    }

    expression = expression.slice(0, -1);
    if (expression === "") expression = '0';
    updateDisplay();
  }

  function handleNegate() {
    if (isCalculated) {
      isCalculated = false;
    }
    
    let lastPart = "";
    let firstPart = "";
    
    if (expression.endsWith('pi')) {
      lastPart = 'pi';
      firstPart = expression.slice(0, -2);
    } else {
      // Find last number term in the expression to prefix with -
      // Walk back and find numerical segments
      let i = expression.length - 1;
      while (i >= 0 && (/[\d.]/.test(expression[i]) || expression[i].toLowerCase() === 'e')) {
        i--;
      }
      lastPart = expression.substring(i + 1);
      firstPart = expression.substring(0, i + 1);
    }
    
    if (firstPart.endsWith('-') && (firstPart.length === 1 || ['+', '*', '/', '^', '(', '%'].includes(firstPart[firstPart.length - 2]))) {
      // It is already negative, strip the minus
      expression = firstPart.slice(0, -1) + lastPart;
    } else {
      expression = firstPart + '-' + lastPart;
    }
    
    if (expression === '') expression = '0';
    updateDisplay();
  }

  function handlePercent() {
    if (isCalculated) {
      expression = (parseFloat(expression) / 100).toString();
      isCalculated = false;
      expressionLine.textContent = '';
    } else {
      // Find the last number term in the expression, parse, divide by 100
      let i = expression.length - 1;
      while (i >= 0 && /[\d.]/.test(expression[i])) {
        i--;
      }
      const numPart = expression.substring(i + 1);
      const rest = expression.substring(0, i + 1);
      if (numPart !== "") {
        const percentValue = parseFloat(numPart) / 100;
        expression = rest + percentValue.toString();
      }
    }
    updateDisplay();
  }

  function evaluate() {
    if (expression === "") return;
    
    // Check parentheses matching
    let openCount = (expression.match(/\(/g) || []).length;
    let closeCount = (expression.match(/\)/g) || []).length;
    let missingClose = openCount - closeCount;
    
    // Auto-complete brackets to be user-friendly
    if (missingClose > 0) {
      expression += ')'.repeat(missingClose);
    }

    const cleanFormula = expression;
    const finalResult = calculateExpression(expression);

    // Render output
    expressionLine.textContent = `${cleanFormula} =`;
    expression = finalResult;
    isCalculated = true;
    updateDisplay();

    // Log to history drawer if successful calculation
    if (!isNaN(parseFloat(finalResult)) && isFinite(finalResult)) {
      saveToHistory(cleanFormula, finalResult);
    }
  }

  // Angle Toggle click
  angleToggleBtn.addEventListener('click', () => {
    angleMode = angleMode === 'DEG' ? 'RAD' : 'DEG';
    angleModeIndicator.textContent = angleMode;
    angleToggleBtn.textContent = `Deg/Rad (${angleMode})`;
  });

  // Wire UI Buttons
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      const action = btn.dataset.action;
      const fn = btn.dataset.fn;

      if (val !== undefined) {
        handleInput(val);
      } else if (fn !== undefined) {
        handleInput(`${fn}(`);
      } else if (action !== undefined) {
        switch (action) {
          case 'clear':
            clearAll();
            break;
          case 'backspace':
            handleBackspace();
            break;
          case 'percent':
            handlePercent();
            break;
          case 'negate':
            handleNegate();
            break;
          case 'equals':
            evaluate();
            break;
          case 'add': handleInput('+'); break;
          case 'subtract': handleInput('-'); break;
          case 'multiply': handleInput('*'); break;
          case 'divide': handleInput('/'); break;
        }
      }
    });
  });

  // Keyboard binding support
  document.addEventListener('keydown', (e) => {
    // If user is focused on forms, don't hijack keyboard inputs
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
      return; 
    }

    const key = e.key;
    if (/[0-9.]/.test(key)) {
      handleInput(key);
    } else if (key === '+') {
      handleInput('+');
    } else if (key === '-') {
      handleInput('-');
    } else if (key === '*') {
      handleInput('*');
    } else if (key === '/') {
      handleInput('/');
    } else if (key === '%') {
      handlePercent();
    } else if (key === '^') {
      handleInput('^');
    } else if (key === '!') {
      handleInput('!');
    } else if (key.toLowerCase() === 'p') {
      handleInput('pi');
    } else if (key.toLowerCase() === 'e') {
      handleInput('e');
    } else if (key === '(' || key === ')') {
      handleInput(key);
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      evaluate();
    } else if (key === 'Backspace') {
      handleBackspace();
    } else if (key === 'Escape' || key.toLowerCase() === 'c') {
      clearAll();
    }
  });


  // ==========================================================================
  // CONVERTER MODULE
  // ==========================================================================
  const unitRatios = {
    length: {
      m: 1.0,
      km: 1000.0,
      cm: 0.01,
      mm: 0.001,
      mi: 1609.344,
      yd: 0.9144,
      ft: 0.3048,
      in: 0.0254
    },
    weight: {
      kg: 1.0,
      g: 0.001,
      lb: 0.45359237,
      oz: 0.028349523125,
      st: 6.35029318
    },
    area: {
      'm²': 1.0,
      'km²': 1000000.0,
      'mi²': 2589988.110336,
      'yd²': 0.83612736,
      'ft²': 0.09290304,
      ac: 4046.8564224,
      ha: 10000.0
    },
    volume: {
      L: 1.0,
      mL: 0.001,
      gal: 3.785411784,
      qt: 0.946352946,
      pt: 0.473176473,
      cup: 0.2365882365,
      'm³': 1000.0
    },
    speed: {
      'm/s': 1.0,
      'km/h': 0.2777777778,
      mph: 0.44704,
      kt: 0.5144444444
    },
    time: {
      s: 1.0,
      min: 60.0,
      h: 3600.0,
      d: 86400.0,
      wk: 604800.0,
      yr: 31536000.0
    }
  };

  const unitLabels = {
    length: { m: 'Meters (m)', km: 'Kilometers (km)', cm: 'Centimeters (cm)', mm: 'Millimeters (mm)', mi: 'Miles (mi)', yd: 'Yards (yd)', ft: 'Feet (ft)', in: 'Inches (in)' },
    weight: { kg: 'Kilograms (kg)', g: 'Grams (g)', lb: 'Pounds (lb)', oz: 'Ounces (oz)', st: 'Stone (st)' },
    temperature: { C: 'Celsius (°C)', F: 'Fahrenheit (°F)', K: 'Kelvin (K)' },
    area: { 'm²': 'Square Meters (m²)', 'km²': 'Square Kilometers (km²)', 'mi²': 'Square Miles (mi²)', 'yd²': 'Square Yards (yd²)', 'ft²': 'Square Feet (ft²)', ac: 'Acres', ha: 'Hectares (ha)' },
    volume: { L: 'Liters (L)', mL: 'Milliliters (mL)', gal: 'Gallons (gal)', qt: 'Quarts (qt)', pt: 'Pints (pt)', cup: 'Cups (cup)', 'm³': 'Cubic Meters (m³)' },
    speed: { 'm/s': 'Meters/Second (m/s)', 'km/h': 'Kilometers/Hour (km/h)', mph: 'Miles/Hour (mph)', kt: 'Knots (kt)' },
    time: { s: 'Seconds (s)', min: 'Minutes (min)', h: 'Hours (h)', d: 'Days (d)', wk: 'Weeks (wk)', yr: 'Years (yr)' }
  };

  function updateConverterUnits() {
    const category = converterCatSelect.value;
    const labels = unitLabels[category];

    // Clear and populate dropdowns
    convertSrcUnit.innerHTML = '';
    convertDestUnit.innerHTML = '';

    Object.entries(labels).forEach(([val, text], idx) => {
      const opt1 = new Option(text, val);
      const opt2 = new Option(text, val);
      
      convertSrcUnit.add(opt1);
      convertDestUnit.add(opt2);

      // Default selections
      if (idx === 0) opt1.selected = true;
      if (idx === 1 || (idx === 0 && Object.keys(labels).length === 1)) opt2.selected = true;
    });

    calculateConversion();
  }

  function calculateConversion() {
    const category = converterCatSelect.value;
    const srcVal = parseFloat(convertSrcVal.value);
    
    if (isNaN(srcVal)) {
      convertDestVal.value = '';
      return;
    }

    const srcUnit = convertSrcUnit.value;
    const destUnit = convertDestUnit.value;

    if (srcUnit === destUnit) {
      convertDestVal.value = srcVal;
      return;
    }

    // Special calculations for Temperature
    if (category === 'temperature') {
      let valInC = srcVal;
      if (srcUnit === 'F') {
        valInC = (srcVal - 32) * 5/9;
      } else if (srcUnit === 'K') {
        valInC = srcVal - 273.15;
      }

      let destVal = valInC;
      if (destUnit === 'F') {
        destVal = valInC * 9/5 + 32;
      } else if (destUnit === 'K') {
        destVal = valInC + 273.15;
      }
      
      convertDestVal.value = Number(destVal.toFixed(6));
      return;
    }

    // Standard conversions using ratios
    const ratios = unitRatios[category];
    const srcRatio = ratios[srcUnit];
    const destRatio = ratios[destUnit];

    const valInBase = srcVal * srcRatio;
    const finalVal = valInBase / destRatio;

    // Output formatted value nicely
    if (finalVal.toString().includes('.') && finalVal.toString().split('.')[1].length > 6) {
      convertDestVal.value = parseFloat(finalVal.toFixed(6));
    } else {
      convertDestVal.value = finalVal;
    }
  }

  // Converter listeners
  converterCatSelect.addEventListener('change', updateConverterUnits);
  convertSrcVal.addEventListener('input', calculateConversion);
  convertSrcUnit.addEventListener('change', calculateConversion);
  convertDestUnit.addEventListener('change', calculateConversion);

  // Init converter state
  updateConverterUnits();


  // ==========================================================================
  // AGE CALCULATOR MODULE
  // ==========================================================================
  // Initialize target date to today
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  if (ageTarget) {
    ageTarget.value = `${yyyy}-${mm}-${dd}`;
  }

  if (btnCalcAge) {
    btnCalcAge.addEventListener('click', () => {
      const dobVal = ageDob.value;
      const targetVal = ageTarget.value;

      if (!dobVal || !targetVal) {
        alert("Please select both dates.");
        return;
      }

      const dob = new Date(dobVal);
      const target = new Date(targetVal);

      // Set times to midnight to avoid timezone offset shifts affecting days
      dob.setHours(0,0,0,0);
      target.setHours(0,0,0,0);

      if (dob > target) {
        alert("Date of Birth cannot be after the target date.");
        return;
      }

      // Calculate exact difference in Years, Months, Days
      let yDiff = target.getFullYear() - dob.getFullYear();
      let mDiff = target.getMonth() - dob.getMonth();
      let dDiff = target.getDate() - dob.getDate();

      if (dDiff < 0) {
        // Days in previous month
        const prevMonthDate = new Date(target.getFullYear(), target.getMonth(), 0);
        dDiff += prevMonthDate.getDate();
        mDiff--;
      }

      if (mDiff < 0) {
        mDiff += 12;
        yDiff--;
      }

      // Main age string
      let ageStr = "";
      if (yDiff > 0) ageStr += `${yDiff} Year${yDiff > 1 ? 's' : ''} `;
      if (mDiff > 0) ageStr += `${mDiff} Month${mDiff > 1 ? 's' : ''} `;
      ageStr += `${dDiff} Day${dDiff > 1 ? 's' : ''}`;
      ageMainResult.textContent = ageStr.trim() === "" ? "0 Days" : ageStr;

      // Next Birthday countdown
      const bMonth = dob.getMonth();
      const bDate = dob.getDate();
      
      let nextBday = new Date(target.getFullYear(), bMonth, bDate);
      nextBday.setHours(0,0,0,0);

      if (nextBday < target) {
        nextBday.setFullYear(target.getFullYear() + 1);
      }

      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = daysOfWeek[nextBday.getDay()];

      // Count time to next birthday
      let yBDiff = nextBday.getFullYear() - target.getFullYear();
      let mBDiff = nextBday.getMonth() - target.getMonth();
      let dBDiff = nextBday.getDate() - target.getDate();

      if (dBDiff < 0) {
        const prevMonthDate = new Date(nextBday.getFullYear(), nextBday.getMonth(), 0);
        dBDiff += prevMonthDate.getDate();
        mBDiff--;
      }
      if (mBDiff < 0) {
        mBDiff += 12;
        yBDiff--;
      }

      let nextBdayStr = "";
      if (mBDiff === 0 && dBDiff === 0) {
        nextBdayStr = `Today! Happy Birthday! (${dayName})`;
      } else {
        if (mBDiff > 0) nextBdayStr += `${mBDiff} Month${mBDiff > 1 ? 's' : ''} `;
        if (dBDiff > 0) nextBdayStr += `${dBDiff} Day${dBDiff > 1 ? 's' : ''}`;
        nextBdayStr = `In ${nextBdayStr.trim()} (${dayName})`;
      }
      ageNextBirthday.textContent = nextBdayStr;

      // Statistics
      const totalMs = target.getTime() - dob.getTime();
      const totalDays = Math.floor(totalMs / (1000 * 60 * 60 * 24));
      const totalMonths = yDiff * 12 + mDiff;
      const totalWeeks = Math.floor(totalDays / 7);
      const remDays = totalDays % 7;
      const totalHours = totalDays * 24;

      ageTotalMonths.textContent = `${totalMonths.toLocaleString()} Month${totalMonths !== 1 ? 's' : ''} ${dDiff} Day${dDiff !== 1 ? 's' : ''}`;
      ageTotalWeeks.textContent = `${totalWeeks.toLocaleString()} Week${totalWeeks !== 1 ? 's' : ''} ${remDays} Day${remDays !== 1 ? 's' : ''}`;
      ageTotalDays.textContent = `${totalDays.toLocaleString()} Day${totalDays !== 1 ? 's' : ''}`;
      ageTotalHours.textContent = `${totalHours.toLocaleString()} Hour${totalHours !== 1 ? 's' : ''}`;

      // Show result wrapper
      ageResults.style.display = 'flex';
    });
  }
});
