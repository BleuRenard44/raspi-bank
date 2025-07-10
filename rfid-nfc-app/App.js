import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import NfcManager, { Ndef, NfcTech } from "react-native-nfc-manager";

NfcManager.start();

export default function App() {
  const apiBase = "http://raspberrypi.local:8000";
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  useEffect(() => {
    fetchAccounts();
    fetchProducts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch(`${apiBase}/accounts`);
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("Erreur", "Chargement comptes : " + e.message);
    }
  }

  async function fetchProducts() {
    try {
      const res = await fetch(`${apiBase}/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("Erreur", "Chargement produits : " + e.message);
    }
  }

  async function writeNfc(text) {
    try {
      await NfcManager.cancelTechnologyRequest();
      await NfcManager.requestTechnology(NfcTech.Ndef);
      await NfcManager.ndefHandler.erase();
      const bytes = Ndef.encodeMessage([Ndef.textRecord(text)]);
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
      await new Promise((resolve) => setTimeout(resolve, 600));
      return true;
    } catch (err) {
      console.error("❌ Erreur écriture NFC:", err);
      Alert.alert("Erreur NFC", err.toString());
      return false;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  async function readCodeFromCard() {
    try {
      await NfcManager.cancelTechnologyRequest();
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      const ndefMessage = tag.ndefMessage;
      if (ndefMessage && ndefMessage.length > 0) {
        const textRecord = Ndef.text.decodePayload(ndefMessage[0].payload);
        return textRecord;
      }
      return null;
    } catch (err) {
      Alert.alert("Erreur NFC", "Lecture du code échouée: " + err.message);
      return null;
    } finally {
      await NfcManager.cancelTechnologyRequest();
    }
  }

  // Modal pour créer un compte
  function ModalCreateAccount({ onClose }) {
    const [code, setCode] = useState("");
    const [nom, setNom] = useState("");
    const [prenom, setPrenom] = useState("");
    const [adresse, setAdresse] = useState("");
    const [loading, setLoading] = useState(false);
    const [messageLocal, setMessageLocal] = useState("");

    async function onWrite() {
      if (loading) return;
      if (!code || code.length !== 6) {
        return Alert.alert("Erreur", "Le code doit contenir exactement 6 caractères");
      }
      if (!nom || !prenom || !adresse) {
        return Alert.alert("Erreur", "Veuillez remplir tous les champs");
      }

      setLoading(true);
      setMessageLocal("Approchez la carte NFC pour écrire le code...");

      const success = await writeNfc(code);
      if (!success) {
        setLoading(false);
        setMessageLocal("");
        return;
      }

      Alert.alert("Succès", "Code écrit sur la carte");

      try {
        const res = await fetch(`${apiBase}/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rfid_uid: code, nom, prenom, adresse }),
        });
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.detail || "Erreur création compte");
        }
        await res.json();
        Alert.alert("Serveur", "Compte créé avec succès");
        fetchAccounts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur serveur", e.message);
      } finally {
        setLoading(false);
        setMessageLocal("");
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Créer un compte</Text>
        <TextInput
          placeholder="Code (6 caractères)"
          style={styles.input}
          value={code}
          onChangeText={setCode}
          maxLength={6}
          editable={!loading}
        />
        <TextInput placeholder="Nom" style={styles.input} value={nom} onChangeText={setNom} editable={!loading} />
        <TextInput placeholder="Prénom" style={styles.input} value={prenom} onChangeText={setPrenom} editable={!loading} />
        <TextInput placeholder="Adresse" style={styles.input} value={adresse} onChangeText={setAdresse} editable={!loading} />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onWrite}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "En cours..." : "Approcher la carte pour écrire"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.message}>{messageLocal}</Text>
      </View>
    );
  }

  // Modal pour ajouter un produit
  function ModalAddProduct({ onClose }) {
    const [name, setName] = useState("");
    const [price, setPrice] = useState("");

    async function handleAdd() {
      if (!name || !price) return Alert.alert("Erreur", "Remplir tous les champs");
      try {
        const res = await fetch(`${apiBase}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, price: parseFloat(price) }),
        });
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.detail || "Erreur ajout produit");
        }
        await res.json();
        fetchProducts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Ajouter un produit</Text>
        <TextInput placeholder="Nom" style={styles.input} value={name} onChangeText={setName} />
        <TextInput
          placeholder="Prix (€)"
          style={styles.input}
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
        />
        <TouchableOpacity style={styles.button} onPress={handleAdd}>
          <Text style={styles.buttonText}>Ajouter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Modal pour faire un achat
  function ModalMakePurchase({ onClose }) {
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [message, setMessage] = useState("");

    async function handlePurchase() {
      if (!selectedProductId) return Alert.alert("Erreur", "Sélectionner un produit");
      setMessage("Approcher la carte...");
      const code = await readCodeFromCard();
      if (!code) {
        setMessage("");
        return;
      }
      try {
        const res = await fetch(`${apiBase}/purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rfid_uid: code, product_id: selectedProductId }),
        });
        const text = await res.text(); // on lit en texte brut
        console.log("Réponse du serveur:", text); // DEBUG : voir la vraie réponse
        if (!res.ok) {
          // essaie de parser un JSON en cas d'erreur, sinon affiche texte brut
          try {
            const errJson = JSON.parse(text);
            throw new Error(errJson.detail || "Erreur achat");
          } catch {
            throw new Error(text || "Erreur achat");
          }
        }
        // si ok, on parse le JSON
        const result = JSON.parse(text);
        Alert.alert("Achat", result.status || "Achat effectué");
        fetchAccounts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setMessage("");
      }
    }


    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Achat produit</Text>
        {products.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => setSelectedProductId(p.id)}
            style={[styles.listItem, selectedProductId === p.id && styles.selectedItem]}
          >
            <Text>
              {p.name} - {p.price}€
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.button} onPress={handlePurchase}>
          <Text style={styles.buttonText}>Acheter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.message}>{message}</Text>
      </View>
    );
  }

  // Modal pour recharger un compte
  function ModalRechargeAccount({ onClose }) {
    const [montant, setMontant] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    async function handleRecharge() {
      if (loading) return;

      const value = parseFloat(montant.replace(",", "."));
      if (isNaN(value) || value <= 0) {
        return Alert.alert("Erreur", "Veuillez saisir un montant valide supérieur à 0");
      }

      setLoading(true);
      setMessage("Approchez la carte NFC...");

      try {
        const code = await readCodeFromCard();
        if (!code) {
          setMessage("");
          setLoading(false);
          return;
        }

        const res = await fetch(`${apiBase}/accounts/${code}/recharge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ montant: value }),
        });

        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.detail || "Erreur lors de la recharge");
        }

        await res.json();
        Alert.alert("Succès", `Compte rechargé de ${value.toFixed(2)} €`);
        setMontant("");
        fetchAccounts();
        onClose();
      } catch (e) {
        Alert.alert("Erreur", e.message);
      } finally {
        setMessage("");
        setLoading(false);
      }
    }

    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Recharger un compte</Text>
        <TextInput
          placeholder="Montant (€)"
          style={styles.input}
          keyboardType="decimal-pad"
          value={montant}
          onChangeText={setMontant}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRecharge}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "En cours..." : "Approcher la carte pour recharger"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onClose}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.message}>{message}</Text>
      </View>
    );
  }

  // Ouvrir une modal avec contenu dynamique
  function openModal(content) {
    setModalContent(content);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setModalContent(null);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Banque RFID</Text>

      <TouchableOpacity
        style={styles.mainButton}
        onPress={() => openModal(<ModalCreateAccount onClose={closeModal} />)}
      >
        <Text style={styles.mainButtonText}>Créer un compte</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.mainButton}
        onPress={() => openModal(<ModalAddProduct onClose={closeModal} />)}
      >
        <Text style={styles.mainButtonText}>Ajouter un produit</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.mainButton}
        onPress={() => openModal(<ModalMakePurchase onClose={closeModal} />)}
      >
        <Text style={styles.mainButtonText}>Faire un achat</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.mainButton}
        onPress={() => openModal(<ModalRechargeAccount onClose={closeModal} />)}
      >
        <Text style={styles.mainButtonText}>Recharger un compte</Text>
      </TouchableOpacity>

      <Text style={styles.subtitle}>Comptes :</Text>
      <ScrollView style={{ maxHeight: 200 }}>
        {accounts.map((a) => (
          <View key={a.rfid_uid} style={styles.listItem}>
            <Text>
              {a.nom} {a.prenom} - Solde: {a.solde} €
            </Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.subtitle}>Produits :</Text>
      <ScrollView style={{ maxHeight: 200 }}>
        {products.map((p) => (
          <View key={p.id} style={styles.listItem}>
            <Text>
              {p.name} - {p.price} €
            </Text>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>{modalContent}</View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fafafa" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  subtitle: { fontSize: 20, fontWeight: "bold", marginTop: 20, marginBottom: 10 },
  mainButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    marginVertical: 6,
  },
  mainButtonText: { color: "white", fontSize: 18, textAlign: "center" },
  listItem: {
    backgroundColor: "#e0e0e0",
    padding: 12,
    borderRadius: 6,
    marginVertical: 4,
  },
  selectedItem: {
    backgroundColor: "#a0caff",
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    maxHeight: "90%",
  },
  modalContent: {},
  modalTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 6,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: "#999",
  },
  cancelButton: {
    backgroundColor: "#999",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    marginTop: 10,
    color: "#333",
  },
});
