import { DockWheel } from "./DockWheel.js";
import { Utils } from "./Utils.js";
import { Point } from "./Point.js";
import { DockManagerContext } from "./DockManagerContext.js";
import { DockNode } from "./DockNode.js";
import { DockLayoutEngine } from "./DockLayoutEngine.js";
import { EventHandler } from "./EventHandler.js";
import { Dialog } from "./Dialog.js";
import { DockGraphSerializer } from "./DockGraphSerializer.js";
import { DockGraphDeserializer } from "./DockGraphDeserializer.js";
import { PanelContainer } from "./PanelContainer.js";
import { DockConfig } from "./DockConfig.js";
import { PanelType } from "./enums/PanelType.js";
/**
 * Dock manager manages all the dock panels in a hierarchy, similar to visual studio.
 * It owns a Html Div element inside which all panels are docked
 * Initially the document manager takes up the central space and acts as the root node
 */
export class DockManager {
    constructor(element, config) {
        if (element === undefined)
            throw new Error('Invalid Dock Manager element provided');
        this._config = Object.assign(new DockConfig(), config);
        this.element = element;
        this.context = this.dockWheel = this.layoutEngine = this.mouseMoveHandler = this.touchMoveHandler = undefined;
        this.layoutEventListeners = [];
        this.defaultDialogPosition = new Point(0, 0);
    }
    get config() {
        return this._config;
    }
    initialize() {
        this.backgroundContext = this.element.children[0];
        this.context = new DockManagerContext(this);
        let documentNode = new DockNode(this.context.documentManagerView);
        this.context.model.rootNode = documentNode;
        this.context.model.documentManagerNode = documentNode;
        this.context.model.dialogs = [];
        this.setRootNode(this.context.model.rootNode);
        // Resize the layout
        this.resize(this.element.clientWidth, this.element.clientHeight);
        this.dockWheel = new DockWheel(this);
        this.layoutEngine = new DockLayoutEngine(this);
        this._undockEnabled = true;
        this.rebuildLayout(this.context.model.rootNode);
        this.zIndexCounter = 1001;
        this.zIndexTabHost = 1000;
        this.zIndexTabHandle = 100;
        this.zIndexDialogCounter = 10001;
        if (this.backgroundContext != null) {
            this.context.model.rootNode.container.tabHost.hostElement
                .insertBefore(this.backgroundContext, this.context.model.rootNode.container.tabHost.hostElement.firstChild);
        }
        this.onKeyPressBound = this.onKeyPress.bind(this);
        this.element.addEventListener('keydown', this.onKeyPressBound);
    }
    onKeyPress(e) {
        if (e.key == "Escape" && this.activePanel && !this.activePanel._hideCloseButton) {
            if ((this.activePanel.isDialog && this._config.escClosesDialog) || (!this.activePanel.isDialog && this._config.escClosesWindow)) {
                let panel = this.activePanel;
                this.activePanel = null;
                panel.close();
            }
        }
    }
    checkXBounds(container, currentMousePosition, previousMousePosition, resizeWest, resizeEast) {
        if (this._config.moveOnlyWithinDockConatiner)
            return this.checkXBoundsWithinDockContainer(container, currentMousePosition, previousMousePosition, resizeWest, resizeEast);
        let dx = Math.floor(currentMousePosition.x - previousMousePosition.x);
        let leftBounds = container.offsetLeft + container.offsetWidth + dx < 40; // || (container.offsetLeft + container.offsetWidth + dx - 40 ) < 0;
        let rightBounds = container.offsetLeft + dx > (window.innerWidth - 40);
        if (leftBounds) {
            previousMousePosition.x = currentMousePosition.x;
            dx = 0;
            let d = 40 - (container.offsetWidth + container.offsetLeft);
            if (d > 0)
                dx = d;
        }
        else if (rightBounds) {
            previousMousePosition.x = currentMousePosition.x;
            dx = 0;
            let d = (window.innerWidth - 40) - container.offsetLeft;
            if (d > 0)
                dx = d;
        }
        return dx;
    }
    checkXBoundsWithinDockContainer(container, currentMousePosition, previousMousePosition, resizeWest, resizeEast) {
        let dx = currentMousePosition.x - previousMousePosition.x;
        let bbOuter = this.element.getBoundingClientRect();
        let bbInner = container.getBoundingClientRect();
        let leftBounds = dx < 0 && bbInner.left + dx < bbOuter.left && !resizeEast;
        let rightBounds = dx > 0 && bbInner.right + dx > bbOuter.right && !resizeWest;
        if (leftBounds) {
            currentMousePosition.x -= dx;
            dx = bbOuter.left - bbInner.left;
            currentMousePosition.x -= dx;
        }
        else if (rightBounds) {
            currentMousePosition.x -= dx;
            dx = bbOuter.right - bbInner.right;
            currentMousePosition.x -= dx;
        }
        return dx;
    }
    checkYBounds(container, currentMousePosition, previousMousePosition, resizeNorth, resizeSouth) {
        if (this._config.moveOnlyWithinDockConatiner)
            return this.checkYBoundsWithinDockContainer(container, currentMousePosition, previousMousePosition, resizeNorth, resizeSouth);
        let dy = Math.floor(currentMousePosition.y - previousMousePosition.y);
        let topBounds = container.offsetTop + dy < 0;
        let bottomBounds = container.offsetTop + dy > (window.innerHeight - 16);
        if (topBounds) {
            previousMousePosition.y = currentMousePosition.y;
            dy = 0;
        }
        else if (bottomBounds) {
            previousMousePosition.y = currentMousePosition.y;
            dy = 0;
            let d = (window.innerHeight - 25) - container.offsetTop;
            if (d > 0)
                dy = d;
        }
        return dy;
    }
    checkYBoundsWithinDockContainer(container, currentMousePosition, previousMousePosition, resizeNorth, resizeSouth) {
        let dy = currentMousePosition.y - previousMousePosition.y;
        let bbOuter = this.element.getBoundingClientRect();
        let bbInner = container.getBoundingClientRect();
        let topBounds = dy < 0 && bbInner.top + dy < bbOuter.top && !resizeSouth;
        let bottomBounds = dy > 0 && bbInner.bottom + dy > bbOuter.bottom && !resizeNorth;
        if (topBounds) {
            currentMousePosition.y -= dy;
            dy = bbOuter.top - bbInner.top;
            currentMousePosition.y -= dy;
        }
        else if (bottomBounds) {
            currentMousePosition.y -= dy;
            dy = bbOuter.bottom - bbInner.bottom;
            currentMousePosition.y -= dy;
        }
        return dy;
    }
    rebuildLayout(node) {
        node.children.forEach((child) => {
            this.rebuildLayout(child);
        });
        node.performLayout(false);
    }
    invalidate() {
        this.resize(this.element.clientWidth, this.element.clientHeight);
    }
    resize(width, height) {
        this.element.style.width = width + 'px';
        this.element.style.height = height + 'px';
        this.context.model.rootNode.container.resize(width, height);
    }
    /**
     * Reset the dock model . This happens when the state is loaded from json
     */
    setModel(model) {
        Utils.removeNode(this.context.documentManagerView.containerElement);
        this.context.model = model;
        this.setRootNode(model.rootNode);
        this.rebuildLayout(model.rootNode);
        this.loadResize(model.rootNode);
        // this.invalidate();
    }
    loadResize(node) {
        node.children.reverse().forEach((child) => {
            this.loadResize(child);
            node.container.setActiveChild(child.container);
        });
        node.children.reverse();
        let container = node.container;
        node.container.resize(container.state.width, container.state.height);
        // node.performLayout();
    }
    setRootNode(node) {
        // if (this.context.model.rootNode)
        // {
        //     // detach it from the dock manager's base element
        //     context.model.rootNode.detachFromParent();
        // }
        // Attach the new node to the dock manager's base element and set as root node
        node.detachFromParent();
        this.context.model.rootNode = node;
        this.element.appendChild(node.container.containerElement);
    }
    _onDialogDragStarted(sender, e) {
        this.dockWheel.activeNode = this._findNodeOnPoint(e.clientX, e.clientY);
        this.dockWheel.activeDialog = sender;
        if (sender.noDocking == null || sender.noDocking !== true)
            this.dockWheel.showWheel();
        if (this.mouseMoveHandler) {
            this.mouseMoveHandler.cancel();
            delete this.mouseMoveHandler;
        }
        if (this.touchMoveHandler) {
            this.touchMoveHandler.cancel();
            delete this.touchMoveHandler;
        }
        this.mouseMoveHandler = new EventHandler(window, 'mousemove', this._onMouseMoved.bind(this));
        this.touchMoveHandler = new EventHandler(window, 'touchmove', this._onMouseMoved.bind(this));
    }
    _onDialogDragEnded(sender, e) {
        if (this.mouseMoveHandler) {
            this.mouseMoveHandler.cancel();
            delete this.mouseMoveHandler;
        }
        if (this.touchMoveHandler) {
            this.touchMoveHandler.cancel();
            delete this.touchMoveHandler;
        }
        this.dockWheel.onDialogDropped(sender);
        this.dockWheel.hideWheel();
        delete this.dockWheel.activeDialog;
        //TODO: not so good
        sender.saveState(sender.elementDialog.offsetLeft, sender.elementDialog.offsetTop);
    }
    _onMouseMoved(e) {
        if (e.changedTouches != null) { // TouchMove Event
            e = e.changedTouches[0];
        }
        this.dockWheel.activeNode = this._findNodeOnPoint(e.clientX, e.clientY);
    }
    /**
     * Perform a DFS (DeepFirstSearch) on the dock model's tree to find the
     * deepest level panel (i.e. the top-most non-overlapping panel)
     * that is under the mouse cursor
     * Retuns null if no node is found under this point
     */
    _findNodeOnPoint(x, y) {
        let stack = [];
        stack.push(this.context.model.rootNode);
        let bestMatch;
        while (stack.length > 0) {
            let topNode = stack.pop();
            if (Utils.isPointInsideNode(x, y, topNode)) {
                // This node contains the point.
                bestMatch = topNode;
                // Keep looking future down
                [].push.apply(stack, topNode.children);
            }
        }
        return bestMatch;
    }
    /** Dock the [dialog] to the left of the [referenceNode] node */
    dockDialogLeft(referenceNode, dialog) {
        return this._requestDockDialog(referenceNode, dialog, this.layoutEngine.dockLeft.bind(this.layoutEngine));
    }
    /** Dock the [dialog] to the right of the [referenceNode] node */
    dockDialogRight(referenceNode, dialog) {
        return this._requestDockDialog(referenceNode, dialog, this.layoutEngine.dockRight.bind(this.layoutEngine));
    }
    /** Dock the [dialog] above the [referenceNode] node */
    dockDialogUp(referenceNode, dialog) {
        return this._requestDockDialog(referenceNode, dialog, this.layoutEngine.dockUp.bind(this.layoutEngine));
    }
    /** Dock the [dialog] below the [referenceNode] node */
    dockDialogDown(referenceNode, dialog) {
        return this._requestDockDialog(referenceNode, dialog, this.layoutEngine.dockDown.bind(this.layoutEngine));
    }
    /** Dock the [dialog] as a tab inside the [referenceNode] node */
    dockDialogFill(referenceNode, dialog) {
        return this._requestDockDialog(referenceNode, dialog, this.layoutEngine.dockFill.bind(this.layoutEngine));
    }
    /** Dock the [container] to the left of the [referenceNode] node */
    dockLeft(referenceNode, container, ratio) {
        return this._requestDockContainer(referenceNode, container, this.layoutEngine.dockLeft.bind(this.layoutEngine), false, ratio);
    }
    /** Dock the [container] to the right of the [referenceNode] node */
    dockRight(referenceNode, container, ratio) {
        return this._requestDockContainer(referenceNode, container, this.layoutEngine.dockRight.bind(this.layoutEngine), true, ratio);
    }
    /** Dock the [container] above the [referenceNode] node */
    dockUp(referenceNode, container, ratio) {
        return this._requestDockContainer(referenceNode, container, this.layoutEngine.dockUp.bind(this.layoutEngine), false, ratio);
    }
    /** Dock the [container] below the [referenceNode] node */
    dockDown(referenceNode, container, ratio) {
        return this._requestDockContainer(referenceNode, container, this.layoutEngine.dockDown.bind(this.layoutEngine), true, ratio);
    }
    /** Dock the [container] as a tab inside the [referenceNode] node */
    dockFill(referenceNode, container) {
        return this._requestDockContainer(referenceNode, container, this.layoutEngine.dockFill.bind(this.layoutEngine), false);
    }
    floatDialog(container, x, y) {
        let retdiag = undefined;
        //check the dialog do not already exist
        this.context.model.dialogs.forEach((dialog) => {
            if (container == dialog.panel) {
                dialog.show();
                dialog.setPosition(x, y);
                retdiag = dialog;
            }
        });
        if (retdiag)
            return retdiag;
        //try to undock just in case
        try {
            let node = this._findNodeFromContainer(container);
            this.layoutEngine.undock(node);
        }
        catch (err) { }
        let panel = container;
        Utils.removeNode(panel.elementPanel);
        panel.isDialog = true;
        let dialog = new Dialog(panel, this);
        dialog.setPosition(x, y);
        return dialog;
    }
    _requestDockDialog(referenceNode, dialog, layoutDockFunction) {
        // Get the active dialog that was dragged on to the dock wheel
        let panel = dialog.panel;
        let newNode = new DockNode(panel);
        panel.prepareForDocking();
        dialog.destroy();
        layoutDockFunction(referenceNode, newNode);
        // this.invalidate();
        return newNode;
    }
    _checkShowBackgroundContext() {
        if (this.backgroundContext != null) {
            if (this.context.model.documentManagerNode.children.length > 0) {
                this.backgroundContext.style.display = "none";
            }
            else {
                this.backgroundContext.style.display = "block";
            }
        }
    }
    _requestDockContainer(referenceNode, container, layoutDockFunction, dockedToPrevious, ratio) {
        // Get the active dialog that was dragged on to the dock wheel
        let newNode = new DockNode(container);
        if (container.containerType === 'panel') {
            let panel = container;
            panel.prepareForDocking();
            Utils.removeNode(panel.elementPanel);
        }
        let ratios = null;
        let oldSplitter;
        if (referenceNode.parent && referenceNode.parent.container) {
            oldSplitter = referenceNode.parent.container;
            if (oldSplitter.getRatios)
                ratios = oldSplitter.getRatios();
        }
        layoutDockFunction(referenceNode, newNode);
        if (ratio && newNode.parent && (newNode.parent.container.containerType === 'vertical' || newNode.parent.container.containerType === 'horizontal')) {
            let splitter = newNode.parent.container;
            if (ratios && oldSplitter == splitter) {
                if (dockedToPrevious) {
                    ratios[ratios.length - 1] = ratios[ratios.length - 1] - ratio;
                    ratios.push(ratio);
                }
                else {
                    ratios[0] = ratios[0] - ratio;
                    ratios.unshift(ratio);
                }
                splitter.setRatios(ratios);
            }
            else
                splitter.setContainerRatio(container, ratio);
        }
        this.rebuildLayout(this.context.model.rootNode);
        this.invalidate();
        this._checkShowBackgroundContext();
        return newNode;
    }
    _requestTabReorder(container, e) {
        let node = this._findNodeFromContainer(container);
        this.layoutEngine.reorderTabs(node, e.handle, e.state, e.index);
    }
    /**
     * Undocks a panel and converts it into a floating dialog window
     * It is assumed that only leaf nodes (panels) can be undocked
     */
    requestUndockToDialog(container, event, dragOffset) {
        let node = this._findNodeFromContainer(container);
        this.layoutEngine.undock(node);
        let panelContainer = node.container;
        panelContainer.elementPanel.style.display = 'block';
        // Create a new dialog window for the undocked panel
        let dialog = new Dialog(panelContainer, this);
        if (event !== undefined) {
            // Adjust the relative position
            let dialogWidth = dialog.elementDialog.clientWidth;
            if (dragOffset.x > dialogWidth)
                dragOffset.x = 0.75 * dialogWidth;
            dialog.setPosition(event.clientX - dragOffset.x, event.clientY - dragOffset.y);
            dialog.draggable.onMouseDown(event);
        }
        return dialog;
    }
    /**
    * closes a Panel
    */
    requestClose(container) {
        let node = this._findNodeFromContainer(container);
        this.layoutEngine.close(node);
        if (this.activePanel == container)
            this.activePanel = null;
        if (this._activeDocument == container)
            this._activeDocument = null;
    }
    /**
     * Opens a Element in a Dialog
     * It is assumed that only leaf nodes (panels) can be undocked
     */
    openInDialog(container, event, dragOffset) {
        // Create a new dialog window for the undocked panel
        let dialog = new Dialog(container, this);
        if (event !== undefined) {
            // Adjust the relative position
            let dialogWidth = dialog.elementDialog.clientWidth;
            if (dragOffset.x > dialogWidth)
                dragOffset.x = 0.75 * dialogWidth;
            dialog.setPosition(event.clientX - dragOffset.x, event.clientY - dragOffset.y);
            dialog.draggable.onMouseDown(event);
        }
        return dialog;
    }
    /** Undocks a panel and converts it into a floating dialog window
     * It is assumed that only leaf nodes (panels) can be undocked
     */
    requestUndock(container) {
        let node = this._findNodeFromContainer(container);
        this.layoutEngine.undock(node);
    }
    /**
     * Removes a dock container from the dock layout hierarcy
     * Returns the node that was removed from the dock tree
     */
    requestRemove(container) {
        let node = this._findNodeFromContainer(container);
        let parent = node.parent;
        node.detachFromParent();
        if (parent)
            this.rebuildLayout(parent);
        return node;
    }
    getNodeByElementId(id) {
        let stack = [];
        stack.push(this.context.model.rootNode);
        while (stack.length > 0) {
            let topNode = stack.pop();
            if (topNode.container instanceof PanelContainer && topNode.container.elementContent.id === id)
                return topNode;
            [].push.apply(stack, topNode.children);
        }
        return null;
    }
    /** Finds the node that owns the specified [container] */
    _findNodeFromContainer(container) {
        let stack = [];
        stack.push(this.context.model.rootNode);
        while (stack.length > 0) {
            let topNode = stack.pop();
            if (topNode.container === container)
                return topNode;
            [].push.apply(stack, topNode.children);
        }
        return null;
    }
    findNodeFromContainerElement(containerElement) {
        let stack = [];
        stack.push(this.context.model.rootNode);
        while (stack.length > 0) {
            let topNode = stack.pop();
            if (topNode.container.containerElement === containerElement)
                return topNode;
            [].push.apply(stack, topNode.children);
        }
        return null;
    }
    addLayoutListener(listener) {
        this.layoutEventListeners.push(listener);
    }
    removeLayoutListener(listener) {
        this.layoutEventListeners.splice(this.layoutEventListeners.indexOf(listener), 1);
    }
    suspendLayout(panel) {
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onSuspendLayout)
                listener.onSuspendLayout(this, panel);
        });
    }
    resumeLayout(panel) {
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onResumeLayout)
                listener.onResumeLayout(this, panel);
        });
    }
    notifyOnDock(dockNode) {
        this._checkShowBackgroundContext();
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onDock) {
                listener.onDock(this, dockNode);
            }
        });
    }
    notifyOnTabsReorder(dockNode) {
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onTabsReorder) {
                listener.onTabsReorder(this, dockNode);
            }
        });
    }
    notifyOnUnDock(dockNode) {
        this._checkShowBackgroundContext();
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onUndock) {
                listener.onUndock(this, dockNode);
            }
        });
    }
    notifyOnClosePanel(panel) {
        this._checkShowBackgroundContext();
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onClosePanel) {
                listener.onClosePanel(this, panel);
            }
        });
        if (this.activePanel == panel)
            this.activePanel = null;
        if (this._activeDocument == panel)
            this._activeDocument = null;
    }
    notifyOnCreateDialog(dialog) {
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onCreateDialog) {
                listener.onCreateDialog(this, dialog);
            }
        });
    }
    notifyOnHideDialog(dialog) {
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onHideDialog) {
                listener.onHideDialog(this, dialog);
            }
        });
    }
    notifyOnShowDialog(dialog) {
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onShowDialog) {
                listener.onShowDialog(this, dialog);
            }
        });
    }
    notifyOnChangeDialogPosition(dialog, x, y) {
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onChangeDialogPosition) {
                listener.onChangeDialogPosition(this, dialog, x, y);
            }
        });
    }
    notifyOnContainerResized(dockContainer) {
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onContainerResized) {
                listener.onContainerResized(this, dockContainer);
            }
        });
    }
    notifyOnTabChange(tabpage) {
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onTabChanged) {
                listener.onTabChanged(this, tabpage);
            }
        });
    }
    notifyOnActivePanelChange(panel, oldActive) {
        this.layoutEventListeners.forEach((listener) => {
            if (listener.onActivePanelChange) {
                listener.onActivePanelChange(this, panel, oldActive);
            }
        });
    }
    saveState() {
        let serializer = new DockGraphSerializer();
        return serializer.serialize(this.context.model);
    }
    loadState(json) {
        let deserializer = new DockGraphDeserializer(this);
        this.context.model = deserializer.deserialize(json);
        this.setModel(this.context.model);
    }
    getPanels() {
        let panels = [];
        //all visible nodes
        this._allPanels(this.context.model.rootNode, panels);
        //all visible or not dialogs
        this.context.model.dialogs.forEach((dialog) => {
            //TODO: check visible
            panels.push(dialog.panel);
        });
        return panels;
    }
    undockEnabled(state) {
        this._undockEnabled = state;
        this.getPanels().forEach((panel) => {
            panel.canUndock(state);
        });
    }
    lockDockState(state) {
        this.undockEnabled(!state); // false - not enabled
        this.hideCloseButton(state); //true - hide
    }
    hideCloseButton(state) {
        this.getPanels().forEach((panel) => {
            panel.hideCloseButton(state);
        });
    }
    updatePanels(ids) {
        let panels = [];
        //all visible nodes
        this._allPanels(this.context.model.rootNode, panels);
        //only remove
        panels.forEach((panel) => {
            if (!Utils.arrayContains(ids, panel.elementContent.id)) {
                panel.close();
            }
        });
        this.context.model.dialogs.forEach((dialog) => {
            if (Utils.arrayContains(ids, dialog.panel.elementContent.id)) {
                dialog.show();
            }
            else {
                dialog.hide();
            }
        });
        return panels;
    }
    getVisiblePanels() {
        let panels = [];
        //all visible nodes
        this._allPanels(this.context.model.rootNode, panels);
        //all visible
        this.context.model.dialogs.forEach((dialog) => {
            if (!dialog.isHidden) {
                panels.push(dialog.panel);
            }
        });
        return panels;
    }
    _allPanels(node, panels) {
        node.children.forEach((child) => {
            this._allPanels(child, panels);
        });
        if (node.container.containerType === 'panel') {
            panels.push(node.container);
        }
    }
    get activeDocument() {
        return this._activeDocument;
    }
    get activePanel() {
        return this._activePanel;
    }
    set activePanel(value) {
        if (value !== this._activePanel) {
            let oldActive = this.activePanel;
            if (this.activePanel) {
                this.activePanel.elementTitle.classList.remove("dockspan-panel-active");
                this.activePanel.elementTitleText.classList.remove("dockspan-panel-titlebar-text-active");
                if (this.activePanel.tabPage) {
                    this.activePanel.tabPage.host.setActive(false);
                }
            }
            this._activePanel = value;
            if (value && value.panelType == PanelType.document) {
                this._activeDocument = value;
            }
            this.notifyOnActivePanelChange(value, oldActive);
            if (value) {
                value.elementTitle.classList.add("dockspan-panel-active");
                value.elementTitleText.classList.add("dockspan-panel-titlebar-text-active");
                if (value.tabPage) {
                    value.tabPage.host.setActive(true);
                }
            }
        }
        else {
            if (value && value.tabPage) {
                value.tabPage.host.setActive(true);
            }
        }
    }
}
//# sourceMappingURL=DockManager.js.map