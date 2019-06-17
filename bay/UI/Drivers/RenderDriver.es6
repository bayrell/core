"use strict;"
/*!
 *  Bayrell Core Library
 *
 *  (c) Copyright 2018-2019 "Ildar Bikmamatov" <support@bayrell.org>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

if (typeof Core == 'undefined') Core = {};
if (typeof Core.UI == 'undefined') Core.UI = {};
if (typeof Core.UI.Drivers == 'undefined') Core.UI.Drivers = {};


Core.UI.Drivers.RenderDriver = class extends Core.UI.Render.CoreManager
{
	
	/**
	 * Warning
	 */
	warning()
	{
		var arr = Array.apply(null, arguments);
		arr.unshift("[Warning]");
		console.log.apply(null, arr);
	}
	
	
	/**
	 * Init Driver
	 */
	_init()
	{
		super._init();
		
		this.view = null;
		this.model = null;
		this.animation_id = null;
		/*
		this.control = new Core.UI.UIController();
		this.control.signal_out.addMethod(
			this.modelChanged.bind(this), 
			new Runtime.Collection("Core.UI.Events.ModelChange")
		);
		*/
		this.managers = {};
		this.managers_hash = {};
		this.remove_keys = [];
		this.is_initializing = false;
	}
	
	
	
	/**
	 * Returns value by name
	 */
	takeValue(variable_name, default_value)
	{
		if (default_value == undefined) default_value = null;
		if (variable_name == "control") return this.control;
		return super.takeValue(variable_name, default_value);
	}
	
	
	
	/**
	 * Model changed
	 */
	modelChanged(e)
	{
		this.model = e.event.model;
		this.is_initializing = false;
		this.runAnimation();
	}
	
	
	
	/**
	 * Update DOM by manager. Return true if manager should update, or false if update should by driver
	 * @return bool
	 */
	shouldUpdateElem(elem, ui)
	{
		return true;
	}
	
	
	
	/**
	 * Overload driver render
	 * @return bool
	 */
	driverRenderOverload(elem, ui)
	{
		return false;
	}
	
	
	
	/**
	 * Save manager
	 */
	saveManager(class_name, key_manager, manager)
	{
		if (this.managers_hash[key_manager] == undefined) this.managers_hash[key_manager] = {};
		this.managers_hash[key_manager][class_name] = manager;
	}
	
	
	
	/**
	 * Search manager
	 */
	searchManager(key_path, class_name)
	{
		var keys = key_path.split(".");
		
		while (keys.length != 0)
		{
			var key = keys.join(".");
			if (this.managers_hash[key] != undefined)
			{
				if (this.managers_hash[key][class_name] != undefined)
				{
					return this.managers_hash[key][class_name];
				}
			}
			keys.pop();
		}
		
		return this;
	}
	
	
	
	/**
	 * Find managers
	 */
	findManager(item)
	{
		var class_name = item.ui.class_name;
		var key_path = item.key_ui;
		var manager = this.searchManager(key_path, class_name);
		
		/* console.log(key_path, class_name, manager); */
		
		return manager;
	}	
	
	
	
	/**
	 * Find parent managers
	 */
	findParentManager(item)
	{
		var class_name = item.ui.class_name;
		var key_path = item.key_ui;
		var keys = key_path.split("."); keys.pop();
		var manager = this.searchManager(keys.join("."), class_name);
		
		/* console.log(key_path, class_name, manager); */
		
		return manager;
	}
	
	
	
	/**
	 * Returns new manager
	 */
	createManager(parent_manager, ui, model, key_manager)
	{
		var manager_name = Runtime.rtl.method( ui.name, "managerName" )();
		var new_manager = null;
		var is_new = false;
		if (this.managers[key_manager] != undefined)
		{
			new_manager = this.managers[key_manager];
		}
		if (new_manager == null) is_new = true;
		else if (new_manager.getClassName() != manager_name) is_new = true;
		
		if (is_new)
		{
			console.log("Create manager ", key_manager, " ", ui.name);
			
			/* Clear old link */
			if (new_manager != null)
			{
				new_manager.setParentManager(null, ""); /* Clear parent_manager */
			}
			
			/* Create new manager */
			new_manager = Runtime.rtl.newInstance(manager_name);
			new_manager.setParentManager(parent_manager, ui); /* Set new parent manager */
			
			this.managers[key_manager] = new_manager;
			
			/* Start New Manager */
			new_manager.onStartManager();
		}
		
		/* Update managers model */
		var old_model = new_manager.model;
		new_manager.driverSetNewModel(model);
		new_manager.onUpdateManager(old_model, model);
		new_manager._key = key_manager;
		
		this.saveManager(ui.name, key_manager, new_manager);
		return new_manager;
	}
	
	
	
	/**
	 * Return true if driver should update DOM of the elem
	 */
	driverShouldUpdateElem(elem, item)
	{
		if (elem._ui == null || elem._ui == undefined)
		{
			return true;
		}
		var manager = this.findManager(item);
		if (manager == null)
		{
			return true;
		}
		if (manager.driverRenderOverload(elem, item.ui))
		{
			return false;
		}
		return manager.shouldUpdateElem(elem, item.ui);
	}
	
	
	
	/**
	 * Returns true if element and ui is different, and element must be recreated
	 */
	isElemDifferent(elem, item)
	{
		if (elem._ui == null) return false;
		if (elem._ui == item.ui) return false;
		
		/* Check if different struct kind or name */
		if (elem._ui.kind != item.ui.kind || elem._ui.name != item.ui.name)
		{
			return true;
		}
		
		/* If different keys */
		if (elem._key != item.key_ui)
		{
			return true;
		}
		
		/* Check if different manager */
		var manager = this.findManager(item);
		if (elem._manager != manager)
		{
			return true;
		}
		
		return false;
	}
	
	
	
	/**
	 * Build annotations
	 */
	buildAnnotations(ui)
	{
		var annotations = new Runtime.Vector();
		if (ui.annotations != null)
		{
			annotations = ui.annotations.toVector();
		}
		if (ui.bind != "")
		{
			annotations.push( new Core.UI.Annotations.BindModel(new Runtime.Dict({ "model": ui.bind })) );
		}
		return annotations;
	}
	
	
	
	/**
	 * Update element props
	 */
	updateElemProps(elem, item)
	{
		var ref_name = null;
		var controller = null;
		var ui = item.ui;
		var manager = this.findManager(item);
		var key_path = item.key_ui;
		var is_new_elem = elem._ui == null;
		var different_key = !is_new_elem && elem._key != key_path;
		
		/* Is new element */
		if (is_new_elem && ui.kind == "element")
		{
			elem._events = {};
			
			if (manager == null)
			{
				this.warning("Manager for item '" + key_path + "' not found in ", elem);
			}
			
			if (ui.reference != "" && manager != null)
			{
				if (manager[ui.reference] == null) manager[ui.reference] = new Runtime.Reference(elem);
				else manager[ui.reference].ref = elem;
			}
			
			var annotations = this.buildAnnotations(ui);
			if (annotations != null && manager != null && annotations.count() > 0)
			{
				for (var i=0; i<annotations.count(); i++)
				{
					var annotation = annotations.item(i);
					var events = annotation.events();
					for (var j=0; j<events.count(); j++)
					{
						var class_name = events.item(j);
						/*console.log(class_name);*/
						var f = Runtime.rtl.find_class(class_name);
						if (f)
						{
							var event_name = f.ES6_EVENT_NAME;
							if (event_name == undefined)
							{
								/* Send mount Event */
								if (class_name == "Core.UI.Events.MountEvent")
								{
									var ref = new Runtime.Reference(elem);
									
									/* Send event */
									annotation.constructor.dispatch
									(
										manager,
										ui,
										annotation,
										new Core.UI.Events.MountEvent(new Runtime.Dict({
											"elem": elem,
											"ui": ui,
										})),
										ref
									);
									
								}
								/*
								console.log(item);
								console.log(class_name);
								console.log(manager);
								*/
							}
							else if (event_name != "")
							{
								//console.log(event_name, annotation.method_name);
								elem.addEventListener(
									event_name, 
									(function (ui, annotation, elem) { return function (e) 
									{
										var event = Core.UI.Events.UserEvent.UserEvent.fromEvent(e);
										var ref = new Runtime.Reference(elem);
										
										/* Send event */
										annotation.constructor.dispatch
										(
											manager,
											ui,
											annotation,
											event,
											ref
										);
										
										if (event.es6_event.defaultPrevented)
										{
											return false;
										}
									} })(ui, annotation, elem)
								);
								
							}
							
						}
					}
				}
			}
			
			if (false && ui.controller != "" && manager != null)
			{
				controller = manager.takeValue(ui.controller);
				if (controller == null)
				{
					this.warning("Controller '" + ui.controller + "' not found in ", elem);
				}
				else
				{
					controller.ref = elem;
					if (controller.events != null)
					{
						for (var i=0; i<controller.events.count(); i++)
						{
							var class_name = controller.events.item(i);
							var f = Runtime.rtl.find_class(class_name);
							if (f)
							{
								var event_name = f.ES6_EVENT_NAME;
								
								if (
									event_name != "" && 
									event_name != undefined && 
									elem._events[event_name] == undefined
								)
								{
									elem.addEventListener(
										event_name, 
										(e) =>
										{
											e = Core.UI.Events.UserEvent.UserEvent.fromEvent(e);
											controller.signal_out.dispatch(e);
											if (e.es6_event.defaultPrevented)
											{
												return false;
											}
										}
									);
								}
							}
							/* console.log(elem); */
						}
					}
					
					/* Send mount event */
					controller.signal_out.dispatch( 
						new Core.UI.Events.MountEvent(new Runtime.Dict({
							"elem": elem,
							"ui": ui,
						})) 
					);
					
				}
			}
			
			
			
		}
		
		if (different_key)
		{
			this.warning("Different keys ", elem._key, key_path, " in ", elem);
		}
		
		elem._manager = manager;
		elem._key = key_path;
		elem._ui = ui;
	}
	
	
	
	/**
	 * Update element attrs
	 */
	updateElemAttrs(elem, item)
	{
		/* Build attrs */
		var attrs = Core.UI.Render.RenderHelper.getUIAttrs(item.ui);
		if (attrs == null)
		{
			return;
		}
		
		var is_input = ["INPUT", "SELECT"].indexOf(elem.tagName) >= 0;
		attrs.each(
			(key, value) => 
			{
				if (is_input && key == "value") return;
				elem.setAttribute(key, value);
			}
		);
		
		if (is_input)
		{
			elem.value = attrs.get("value", "");
		}
		/*
		if (elem instanceof HTMLElement)
		{
			elem.setAttribute("x-key", item.key_ui);
		}*/
	}
	
	
	
	/**
	 * Create DOM by UI Struct
	 */
	createElem(prev_elem, item)
	{
		if (prev_elem == undefined) prev_elem = null;
		
		/* If is component */
		if (item.ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
		{
			var elem = document.createElement(item.ui.name);
			this.updateElemProps(elem, item);
			
			/* Update element props */
			this.updateElemAttrs(elem, item);
			
			/* Update DOM children */
			if (prev_elem != null)
			{
				while (prev_elem.hasChildNodes()) 
				{
					elem.appendChild(prev_elem.firstChild);
				}
			}
			
			var manager = this.findManager(item);
			this.updateDOMChildsInit(manager, elem, item.ui.children, item.key_ui);
			
			return elem;
		}
		
		/* If is string */
		else if (item.ui.kind == Runtime.UIStruct.TYPE_RAW)
		{
			var elem = document.createTextNode(item.ui.content);
			this.updateElemProps(elem, item);
			return elem;
		}
		
		return null;
	}
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateElem(elem, item)
	{
		if (elem._ui == item.ui) return elem;
		
		/* Should update item DOM */
		if (!this.driverShouldUpdateElem(elem, item))
		{
			return elem;
		}
		
		/* Create new DOM if elem and ui is different */
		if (this.isElemDifferent(elem, item))
		{
			return this.createElem(elem, item);
		}
		
		this.updateElemProps(elem, item);
		if (item.ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
		{
			/* Set props */
			this.updateElemAttrs(elem, item);
			
			/* Update DOM children */
			var manager = this.findManager(item);
			this.updateDOMChilds(manager, elem, item.ui.children, item.key_ui);
		}
		else if (item.ui.kind == Runtime.UIStruct.TYPE_RAW)
		{
			if (elem.nodeValue != item.ui.content)
				elem.nodeValue = item.ui.content;
		}
		
		return elem;
	}
	
	
	
	/**
	 * Unpack components
	 */
	unpackComponents(manager, template, key_path)
	{
		var index = 0;
		var arr = new Runtime.Vector();
		while (index < template.count())
		{
			var ui = template.item(index);
			var key_ui = Runtime.UIStruct.getKeyPath(ui, key_path, index);
			arr.push({ "ui": ui, "key_ui": key_ui + ""  });
			index++;
		}
		
		var arr2;
		var has_components = true;
		while (has_components)
		{
			index = 0;
			has_components = false;
			arr2 = new Runtime.Vector();
			while (index < arr.count())
			{
				var item = arr.item(index);
				var ui = item.ui;
				var key_ui = item.key_ui;
				index++;
				
				/* if ui is component */
				if (ui.kind == Runtime.UIStruct.TYPE_COMPONENT)
				{					
					/* Render view */
					var model = Runtime.UIStruct.getModel(ui);
					var f = Runtime.rtl.method( ui.name, "render" );
					var t = f( model, ui );
					
					/* Find manager by path or create new manager if does not exists */
					var parent_manager = this.findParentManager(item);
					var new_manager = this.createManager(parent_manager, ui, model, key_ui);
					
					/* Normalize ui vector */
					if (!(t instanceof Runtime.Collection))
					{
						t = Runtime.RuntimeUtils.normalizeUIVector(t);
					}
					
					/* Analyze manager struct */
					for (var index_t=0; index_t<t.count(); index_t++)
					{
						var t_ui = t.item(index_t);
						var key_item = Runtime.UIStruct.getKeyPath(t_ui, key_ui, index_t);
						arr2.push({ "ui": t_ui, "key_ui": key_item, "manager": new_manager, });
						
						if (t_ui.kind == Runtime.UIStruct.TYPE_COMPONENT)
						{
							has_components = true;
						}
					}
				}
				
				/* if ui is element */
				else
				{
					arr2.push(item);
				}
				
			}
			
			arr = arr2.copy();
		}
		
		return arr;
	}
	
	
	
	/**
	 * Find elem by key
	 */
	findElemByKey(elem, key)
	{
		for (var i = 0; i < elem.children.length; i++)
		{
			if (elem.childNodes[i]._key == key)
			{
				return elem.childNodes[i];
			}
		}
		return null;
	}
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateDOMChilds(manager, elem, template, key_path)
	{
		if (this.is_initializing) this.updateDOMChildsInit(manager, elem, template, key_path);
		else this.updateDOMChildsUpdate(manager, elem, template, key_path);
	}
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateDOMChildsUpdate(manager, elem, template, key_path)
	{
		var res = [];
		var append_arr = [];
		var update_arr = [];
		var remove_arr = [];
		var is_update = false;
		var update_keys = [];
		
		/* If has childs */
		if (template != null)
		{
			var items = this.unpackComponents(manager, template, key_path);
			var index_item = 0;
			for (var index_item=0; index_item<items.count(); index_item++)
			{
				var item = items.item(index_item);
				var e = this.findElemByKey(elem, item.key_ui);
				
				if (e == null)
				{
					e = this.createElem(null, item);
					res.push(e);
				}
				else
				{
					var new_e = this.updateElem(e, item);
					res.push(new_e);
					if (e != new_e)
					{
						is_update = true;
						update_keys.push(item.key_ui);
					}
				}
			}
		}
		
		
		/* Check if changed */
		var is_change = false;
		if (res.length == elem.childNodes.length)
		{
			for (var i=0; i<res.length; i++)
			{
				var e1 = elem.childNodes[i];
				var e2 = res[i];
				
				if (e1 instanceof Text && e2 instanceof Text)
				{
					if (e1.textContent != e2.textContent)
					{
						/* console.log("Change", e1.textContent, e2.textContent); */
						is_change = true;
						break;
					}
				}
				else if (
					e1 instanceof Text && !(e2 instanceof Text) || 
					e2 instanceof Text && !(e1 instanceof Text)
				)
				{
					is_change = true;
					break;
				}
				else if (e1._key != e2._key)
				{
					is_change = true;
					break;
				}
				else if (update_keys.indexOf(e2._key) != -1)
				{
					is_change = true;
					break;
				}
				
			}
		}
		else
		{
			is_change = true;
		}
		
		
		/* Replace childs */
		if (is_change)
		{
			/* console.log("Change Elem", elem); */
			
			var findElementPos = function (elem, e)
			{
				var childs = elem.childNodes;
				for (var i = 0; i < elem.childNodes.length; i++)
				{
					if (childs[i] == e)
					{
						return i;
					}
				}
				return -1;
			}
			
			var insertFirst = function (elem, e)
			{
				if (elem.childNodes.length == 0)
				{
					elem.appendChild(e);
				}
				else
				{
					elem.insertBefore(e, elem.firstChild);
				}
			}
			
			var insertAfter = function (elem, prev, e)
			{
				if (prev == null)
				{
					insertFirst(elem, e);
					return;
				}
				var next = prev.nextSibling;
				if (next == null)
				{
					elem.appendChild(e);
				}
				else
				{
					elem.insertBefore(e, next);
				}
			}
			
			
			/* Remove elems */
			var i = elem.childNodes.length - 1;
			while (i >= 0)
			{
				var e = elem.childNodes[i];
				if (res.indexOf(e) == -1)
				{
					elem.removeChild(e);
					this.remove_keys.push(e._key);
					/* console.log('Remove child ', i); */
				}
				i--;
			}
			
			
			var prevElem = null;
			for (var i=0; i<res.length; i++)
			{
				var e = res[i];
				var pos = findElementPos(elem, e);
				var flag = false;
				
				/* If new element */
				if (pos == -1)
				{
					if (prevElem == null)
					{
						insertFirst(elem, e);
						flag = true;
						/* console.log('Insert first ', i); */
					}
					else
					{
						insertAfter(elem, prevElem, e);
						flag = true;
						/* console.log('Insert after[1] ', i); */
					}
				}
				
				/* If existing element */
				else
				{
					if (pos - 1 < 0)
					{
						if (i != 0)
						{
							insertAfter(elem, prevElem, e);
							flag = true;
							/* console.log('Insert after[2] ', i); */
						}
					}
					else
					{
						var prevSibling = elem.childNodes[pos - 1];
						if (prevElem != prevSibling)
						{
							insertAfter(elem, prevElem, e);
							flag = true;
							/* console.log('Insert after[3] ', i); */
						}
					}
				}
				
				if (flag)
				{
					var index = this.remove_keys.indexOf(e._key);
					if (index != -1)
						this.remove_keys.splice(index, 1);
				}
				
				prevElem = e;
			}
			
			
			
			/*
			var keys = {};
			while (elem.firstChild)
			{
				keys[elem.firstChild._key] = 1;
				elem.removeChild(elem.firstChild);
			}
			for (var i=0; i<res.length; i++)
			{
				var e = res[i];
				keys[e._key] = 0;
				elem.appendChild(e);
			}
			for (var key in keys)
			{
				if (keys[key] == 1)
				{
					this.remove_keys.push(key);
				}
			}
			*/
		}
	}
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateDOMChildsInit(manager, elem, template, key_path)
	{
		var res = [];
		var append_arr = [];
		var update_arr = [];
		var remove_arr = [];
		var index_item = 0;
		var index_elem = 0;
		
		/* If has childs */
		if (template != null)
		{
			var items = this.unpackComponents(manager, template, key_path);
			while (index_item < items.count())
			{
				var e = elem.childNodes[index_elem];
				var item = items.item(index_item);
				index_item++;
				index_elem++;
				
				if (e == undefined || e == null)
				{
					e = this.createElem(null, item);
					if (e != null) append_arr.push(e);
				}
				else
				{
					var new_item = this.updateElem(e, item);
					if (new_item != e)
					{
						update_arr.push({"old_item": e, "new_item": new_item});
						e = new_item;
					}
				}
			}
		}
		
		/* Remove items */
		while (index_elem < elem.childNodes.length)
		{
			var e = elem.childNodes[index_elem];
			remove_arr.push(e);
			index_elem++;
		}
		
		/* Apply changes */
		for (var i=0; i<remove_arr.length; i++)
		{
			var e = remove_arr[i];
			elem.removeChild( e );
		}
		for (var i=0; i<append_arr.length; i++)
		{
			elem.appendChild( append_arr[i] );
		}
		for (var i=0; i<update_arr.length; i++)
		{
			elem.replaceChild(update_arr[i].new_item, update_arr[i].old_item);
		}
	}
	
	
	
	/**
	 * Run web driver
	 */
	run(selector, view, model)
	{
		model = Runtime.RuntimeUtils.json_decode( atob(model) );
		
		this.view = view;
		this.selector = selector;
		this.model = model;
		
		var root = document.querySelector( this.selector );
		root._driver = this;
		
		this.is_initializing = true;
		this.runAnimation();
	}
	
	
	/** Animation **/
	
	runAnimation()
	{
		if (this.animation_id == null)
		{
			this.animation_id = requestAnimationFrame( this.animation.bind(this) );
		}
	}
	
	
	
	/**
	 * Animation function
	 */
	animation()
	{
		/* console.log('*** animation ***'); */
		
		Runtime.rtl._memorizeClear();
		this.managers_hash = {};
		this.animation_id = null;
		this.remove_keys = [];
		
		var root = document.querySelector( this.selector );
		var template = new Runtime.Collection( 
			new Runtime.UIStruct(
				new Runtime.Dict({
					"name": this.view,
					"kind": Runtime.UIStruct.TYPE_COMPONENT,
					"model": this.model,
					"annotations": new Runtime.Collection(
						new Core.UI.Annotations.Event(
							new Runtime.Dict({
								"event": "Core.UI.Events.ModelChange",
								"method_name": "modelChanged",
							})
						)
					),
				})
			)
		);
		this.updateDOMChilds(this, root, template, "");
		
		for (var key in this.managers)
		{
			this.managers[key]._model_updated_by_self = false;
			this.managers[key]._model_updated_by_driver = false;
		}
		
		/* Remove unused managers */
		if (this.remove_keys.length != 0)
		{
			var keys = [];
			for (var key in this.managers)
			{
				if (this.hasRemoveManagersKey(key))
				{
					keys.push(key);
				}
			}
			for (var i=0; i<keys.length; i++)
			{
				var key = keys[i];
				var manager = this.managers[key];
				manager.setParentManager(null, ""); /* Clear controller */
				manager.destroyManager();
				this.managers[key] = null;
				delete this.managers[key];
				console.log("Remove manager ", key);
			}
		}
	}
	
	
	
	/**
	 * Has remove managers by key
	 */
	hasRemoveManagersKey(key)
	{
		for (var i=0; i<this.remove_keys.length; i++)
		{
			var k = this.remove_keys[i];
			if (key.indexOf(k) == 0)
			{
				return true;
			}
		}
		return false;
	}
	
}


window['context'] = Runtime.RuntimeUtils.registerGlobalContext();
window['RenderDriver'] = new Core.UI.Drivers.RenderDriver();
window['RenderDriver'].run('#root', document.getElementById('view').value, document.getElementById('model').value);
